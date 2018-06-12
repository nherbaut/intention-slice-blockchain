#!/usr/bin/env node

'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const winston = require('winston');
var yaml = require('js-yaml')
var fs = require('fs');
var _ = require('underscore');
var rn = require('random-number');
var chalk = require('chalk');
let config = require('config').get('event-app');
const LOG = winston.loggers.get('application');
let cardname = config.get('cardname');
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



	/** Listen for the sale traniiiiiisaction events
		  */
	listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', async (evt) => {

			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentEvent") {

				for (let slice of evt.target.slices) {
					console.log("they want:" + slice)
				}


			}


		});
	}


}



var lnr = new SitechainListener();
lnr.init().then(lnr.listen())
