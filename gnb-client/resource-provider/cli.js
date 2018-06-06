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
		this.transportResourceRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.TransportResource");
		this.computeResourceRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.ComputeResource");
		this.radioResourceRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.RadioResource");

		setInterval(this.updatedb.bind(this), 10000);

	}


	async updatedb() {
		console.log("updating db");

		var rps = await this.rpRegistry.getAll();
		var rp = rps[0];
		if (rp.resources != undefined) {
			for (let r of rp.resources) {
				//console.log(r.getIdentifier())
			}
		}

		let buffer = fs.readFileSync("net.yaml", 'utf8');

		let netContent = yaml.load(buffer);
		let factory = this.businessNetworkDefinition.getFactory();

		var resource = null
		var registry = null
		var assetType = null
		for (let edge of netContent.edges) {
			switch (edge.type) {
				case "core":
					assetType = 'ComputeResource'
					resource = factory.newResource('top.nextnet.gnb', assetType, edge.id);
					resource.computing_capacity = edge["attrs"]["computing_capacity"][1]
					resource.memory = edge["attrs"]["memory"][1]
					registry = this.computeResourceRegistry
					break
				case "radio":
					assetType = "RadioResource"
					resource = factory.newResource('top.nextnet.gnb', assetType, edge.id);
					resource.fronthaul_link_capacity = edge["attrs"]["fronthaul_link_capacity"][1]
					resource.fronthaul_link_latency = edge["attrs"]["fronthaul_link_latency"][1]
					resource.mac_scheduler = edge["attrs"]["mac_scheduler"][1]
					resource.pRB_amount = edge["attrs"]["pRB_amount"][1]
					registry = this.radioResourceRegistry
					break
				case "transport":
					assetType = "TransportResource"
					resource = factory.newResource('top.nextnet.gnb', assetType, edge.id);
					registry = this.computeResourceRegistry
					resource.bandwidth = edge["attrs"]["bandwidth"][1]
					resource.latency = edge["attrs"]["latency"][1]

			}


			resource.src = edge.node1.toString();
			resource.dst = edge.node2.toString();
			resource.price = edge["attrs"]["price"][1]
			resource.id = edge.id.toString()

			let update_found = false
			for (let r of rp.resources) {
				//console.log("is " + r.getIdentifier() + " the same as " + resource.id)
				if (r.getIdentifier() == resource.id) {
					var rr = await registry.get(r.getIdentifier())
					update_found = true;
					if (!_.isEqual(resource, rr)) {
						await registry.update(resource);
						//console.log("updated "+ resource.id)
					}
					else {
						//console.log("update skipped "+ resource.id)
					}

					break;
				}
			}
			if (!update_found) {
				try {
					await registry.add(resource);
				}
				catch (err) {
					//console.log("ignoring duplicate resource")
				}

				rp.resources.push(factory.newRelationship('top.nextnet.gnb', assetType, resource.id));


			}






		}

		await this.rpRegistry.update(rp);
	}


	/** Listen for the sale transaction events
		  */
	listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', (evt) => {
			

			

		});
	}


}



var lnr = new SitechainListener();
lnr.init();
