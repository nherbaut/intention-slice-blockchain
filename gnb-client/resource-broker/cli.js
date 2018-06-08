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
		this.intentionRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Intention");
		this.serviceRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Service");
		this.factory = await this.bizNetworkConnection.getBusinessNetwork().getFactory();
	}


	get_random_slice() {
		var slice = this.factory.newConcept("top.nextnet.gnb", "TransportSlice")
		slice.src = "" + Math.floor(Math.random() * 100);
		slice.dst = "" + Math.floor(Math.random() * 100);
		slice.bandwidth = Math.floor(Math.random() * 100);
		slice.latency = Math.floor(Math.random() * 20) + 5;

		return slice;

	}
	generate_services(intention) {
		var intentionData = intention.intentionData

		var services = []
		for (let i of [0, 1, 2]) {
			var service = this.factory.newResource("top.nextnet.gnb", "Service", uuid());
			service.slices = []
			for (let j of [0, 1, 2, 3]) {
				service.slices.push(this.get_random_slice());
			}
			service.public = true;
			service.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());
			services.push(service);
		}

		return services;


	}


	/** Listen for the sale transaction events
		  */
	listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', (evt) => {

			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewIntentionEvent") {




				this.intentionRegistry.get(evt.target.getIdentifier()).then(
					intention => {

						var services = this.generate_services(intention)
						this.serviceRegistry.addAll(services).then(
							console.log(services.length + " services added"));
					}

				)
			}
		})

	}



}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
