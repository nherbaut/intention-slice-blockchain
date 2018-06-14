#!/usr/bin/env node

'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const winston = require('winston');
var yaml = require('js-yaml')
var fs = require('fs');
var _ = require('underscore');
var rn = require('random-number');
var chalk = require('chalk');
const uuid = require('uuid/v4');
let config = require('config').get('event-app');
const LOG = winston.loggers.get('application');
let cardname = config.get('cardname');
let resourceProviderName = cardname.split("@")[0]
let netname = config.get("netname")
var rnoptions = {
	min: 0
	, max: 10000
	, integer: true
}
class SitechainListener {

	constructor() {

		this.bizNetworkConnection = new BusinessNetworkConnection();

	}


	async init() {
		this.businessNetworkDefinition = await this.bizNetworkConnection.connect(cardname);
		this.rpRegistry = await this.bizNetworkConnection.getParticipantRegistry("top.nextnet.gnb.ResourceProvider");
		this.serviceFragmentRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.ServiceFragment");
		this.resourceProvider = (await this.rpRegistry.getAll())[0]
		this.bidRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Bid");
		this.factory = await this.bizNetworkConnection.getBusinessNetwork().getFactory();
		setInterval(this.updatedb.bind(this), 10000);

	}


	async updatedb() {
		console.log("updating db");
		this.resourceProvider = (await this.rpRegistry.getAll())[0]



		let buffer = fs.readFileSync(netname, 'utf8');

		let netContent = yaml.load(buffer);
		let factory = this.businessNetworkDefinition.getFactory();

		var resource = null
		var registry = null
		var assetType = null
		let has_one_update = false
		for (let edge of netContent.edges) {
			switch (edge.type) {
				case "core":
					assetType = 'ComputeSliceProposal'
					resource = factory.newConcept('top.nextnet.gnb', assetType, edge.id);
					resource.computing_capacity = edge["attrs"]["computing_capacity"][1]
					resource.memory = edge["attrs"]["memory"][1]
					resource.location = edge.node1.toString();
					break
				case "radio":
					assetType = "RadioSliceProposal"
					resource = factory.newConcept('top.nextnet.gnb', assetType, edge.id);
					resource.fronthaul_link_capacity = edge["attrs"]["fronthaul_link_capacity"][1]
					resource.fronthaul_link_latency = edge["attrs"]["fronthaul_link_latency"][1]
					resource.mac_scheduler = edge["attrs"]["mac_scheduler"][1]
					resource.pRB_amount = edge["attrs"]["pRB_amount"][1]
					resource.location = edge.node1.toString();
					break
				case "transport":
					assetType = "TransportSliceProposal"
					resource = factory.newConcept('top.nextnet.gnb', assetType, edge.id);
					resource.bandwidth = edge["attrs"]["bandwidth"][1]
					resource.latency = edge["attrs"]["latency"][1]
					resource.src = edge.node1.toString();
					resource.dst = edge.node2.toString();


			}



			resource.price = edge["attrs"]["price"][1]
			resource.id = edge.id.toString()


			let update_found = false
			if (this.resourceProvider.slices == undefined) {
				this.resourceProvider.slices = []
			}
			for (let entry of this.resourceProvider.slices.entries()) {
				var i, r
				[i, r] = entry
				//console.log("is " + r.getIdentifier() + " the same as " + resource.id)
				if (r.id == resource.id) {
					update_found = true;
					if (!_.isEqual(resource, r)) {

						this.resourceProvider.slices[i] = resource
						has_one_update = true


					}
					break;
				}
			}
			if (!update_found) {
				try {
					this.resourceProvider.slices.push(resource);
					has_one_update = true
				}
				catch (err) {
					//console.log("ignoring duplicate resource")
				}

			}

		}

		if (has_one_update) {
			await this.rpRegistry.update(this.resourceProvider);
		}
	}

	getPriceForSliceTransport(slice, myslice) {
		if (
			(slice.src == myslice.src &&
				slice.dst == myslice.dst) || (slice.src == myslice.dsr &&
					slice.dst == myslice.src) &&
				slice.bandwidth <= myslice.bandwidth &&
			slice.latency >= myslice.latency
		) {
			return myslice.price
		}

		else return -1;
	}

	getPriceForSliceRadio(slice, myslice) {
		return -1;
	}

	getPriceForSliceCompute(slice, myslice) {
		return -1;
	}

	getPriceForSlice(slice) {
		for (let myslice of this.resourceProvider.slices) {
			var resolver = null;
			if (slice.getFullyQualifiedType() + "Proposal" == myslice.getFullyQualifiedType()) {
				switch (slice.getFullyQualifiedType()) {
					case "top.nextnet.gnb.TransportSlice":
						resolver = this.getPriceForSliceTransport;
						break;
					case "top.nextnet.gnb.ComputeSlice":
						resolver = this.getPriceForSliceCompute;
						break;
					case "top.nextnet.gnb.RadioSlice":
						resolver = this.getPriceForSliceRadio;
						break;
				}

				var price = resolver(slice, myslice);
				if (price > 0) {
					return price;
				}


			}
		}

		return -1;

	}
	async getBidForFragment(fragment) {
		let price = 0;

		const query = this.bizNetworkConnection.buildQuery('SELECT top.nextnet.gnb.Bid WHERE ( owner!=_$me AND fragment == _$fragID)');
		const assets = await this.bizNetworkConnection.query(query, { me: "resource:top.nextnet.gnb.ResourceProvider#" + resourceProviderName, fragID: "resource:top.nextnet.gnb.ServiceFragment#" + fragment.getIdentifier() });

		if (assets.length == 0) {//if no competition so far
			var best_buy = 9999
		}
		else {
			var best_buy = assets.sort(function (obj1, obj2) { return obj1.price - obj2.price })[0];
		}

		//get the cost price, if we can't find it, return error (-1)
		for (let slice of fragment.slices) {


			var slicePrice = this.getPriceForSlice(slice);
			if (slicePrice > 0) {
				price += slicePrice;
			}
			else return -1;
		}

		//if we can do better that the best_buy, tell it, otherwise, error
		if (best_buy > price) {
			return (best_buy - price) / 2
		}
		else {
			return -1;
		}

	}


	/** Listen for the sale traniiiiiisaction events
		  */
	listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', async (evt) => {

			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentEvent") {

				var serviceFragment = await this.serviceFragmentRegistry.get(evt.target.getIdentifier());
				var best_price = await this.getBidForFragment(serviceFragment);
				if (best_price > 0) {
					var bid = this.factory.newResource("top.nextnet.gnb", "Bid", uuid());
					bid.price = best_price
					bid.fragment = this.factory.newRelationship("top.nextnet.gnb", "ServiceFragment", serviceFragment.getIdentifier());
					bid.owner = this.factory.newRelationship("top.nextnet.gnb", "ResourceProvider", resourceProviderName);

					await this.bidRegistry.add(bid);
					var placeBidTransaction = this.factory.newTransaction("top.nextnet.gnb", "PlaceBid");
					placeBidTransaction.target = bid;

					await this.bizNetworkConnection.submitTransaction(placeBidTransaction);
				}


			}


		});
	}


}



var lnr = new SitechainListener();
lnr.init().then(lnr.listen())
