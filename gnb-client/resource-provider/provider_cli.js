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

		this.bidRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Bid");
		this.factory = await this.bizNetworkConnection.getBusinessNetwork().getFactory();
		await this.updatedb();
		setInterval(this.updatedb.bind(this), 10000);


	}


	async updatedb() {
		//console.log("updating db");
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
				slice.dst == myslice.dst) || (slice.src == myslice.dst &&
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
	getBidForFragment(fragment) {
		let price = 0;

		var bestPrice = fragment.bestPrice == undefined ? 9999999 : fragment.bestPrice
		//get the cost price, if we can't find it, return error (-1)
		for (let slice of fragment.slices) {
			var slicePrice = this.getPriceForSlice(slice);
			if (slicePrice > 0) {
				price += slicePrice;
				console.log("slice " + slice.src + " " + slice.dst + " be price" + slicePrice);
			}
			else return -1;
		}

		//if we can do better that the best_buy, tell it, otherwise, error
		if (bestPrice > Math.ceil(price)) {

			var bid = Math.min(Math.ceil((bestPrice + price) / 2), Math.ceil(price * 5));
			console.log("my fragment price is " + price + " which is better than the best price " + bestPrice + " so i'm gonna bill " + bid);
			return bid;
		}
		else {
			console.log("I can't compete with " + bestPrice + " since by break even price is" + price);
			return -1;
		}

	}


	async handleServiceFragmentDeal(serviceFragment, bestPrice, bestCompetitor) {



		if (serviceFragment.bestBid == undefined || serviceFragment.bestRP.getIdentifier() != resourceProviderName) {//no self concurrence!
			var myBestPrice = this.getBidForFragment(serviceFragment);


			if (myBestPrice > 0) {
				console.log("competing with " + bestCompetitor + "  " + bestPrice + " vs " + resourceProviderName + " " + myBestPrice + " for fragment " + serviceFragment.slices.reduce((acc, sl) => acc + " " + sl.src + "-" + sl.dst, " "));
				var bid = this.factory.newResource("top.nextnet.gnb", "Bid", uuid().slice(0, 5));
				bid.price = myBestPrice
				bid.fragment = this.factory.newRelationship("top.nextnet.gnb", "ServiceFragment", serviceFragment.getIdentifier());
				bid.owner = this.factory.newRelationship("top.nextnet.gnb", "ResourceProvider", resourceProviderName);
				await this.bidRegistry.add(bid);


				var placeBidTransaction = this.factory.newTransaction("top.nextnet.gnb", "PlaceBid");
				placeBidTransaction.target = bid;

				var start = new Date();
				await this.bizNetworkConnection.submitTransaction(placeBidTransaction);
				console.log("Took " + (new Date().getTime() - start.getTime()) + " to place bid for fragment " + serviceFragment.getIdentifier());
			}

		}
	}

	/** Listen for the sale traniiiiiisaction events
		  */
	listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', async (evt) => {

			//a new service, we try to compete
			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentEvent") {
				var serviceFragment = evt.target;
				console.log("New Service Fragment Published!" + serviceFragment.getIdentifier());
				this.handleServiceFragmentDeal(serviceFragment);
			}
			//a new deal, we try to compete if we didn't win
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentDealEvent") {
				var deal = evt.target;
				if (deal.bestRP != resourceProviderName) {
					var serviceFragment = await this.serviceFragmentRegistry.get(deal.fragment.getIdentifier());
					this.handleServiceFragmentDeal(serviceFragment);
				}
				else {
					console.log(resourceProviderName + "> I'm already best in class for " + deal.fragment.getIdentifier());
				}

			}


		});
	}


}



var lnr = new SitechainListener();
lnr.init().then(lnr.listen())
