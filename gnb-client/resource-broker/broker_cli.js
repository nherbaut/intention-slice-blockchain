#!/usr/bin/env node

'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const winston = require('winston');
var yaml = require('js-yaml');
const util = require('util');
var fs = require('fs');
var _ = require('underscore');
var rn = require('random-number');
var chalk = require('chalk');
var promiseRetry = require('promise-retry');
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
		this.serviceFragmentRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.ServiceFragment");
		this.publishServiceTransactionRegistry = await this.bizNetworkConnection.getTransactionRegistry("top.nextnet.gnb.PublishService");
		this.factory = await this.bizNetworkConnection.getBusinessNetwork().getFactory();
		setInterval(this.monitorServiceFragments.bind(this), 10000);
		this.updatedFragments = {}
	}


	get_random_slice() {
		var slice = this.factory.newConcept("top.nextnet.gnb", "TransportSlice")
		slice.src = "" + Math.floor(Math.random() * 100);
		slice.dst = "" + Math.floor(Math.random() * 100);
		slice.bandwidth = Math.floor(Math.random() * 100);
		slice.latency = Math.floor(Math.random() * 20) + 5;
		slice.id = uuid();

		return slice;

	}
	generate_services(intention) {
		var intentionData = intention.intentionData

		var services = []
		for (let i of [0, 1, 2]) {
			var id = uuid().replace("-", "");
			var service = this.factory.newResource("top.nextnet.gnb", "Service", id);
			service.serviceId = id
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


	async monitorServiceFragments() {


		var fragments = await this.serviceFragmentRegistry.getAll();
		for (let fragment of fragments) {
			const query = this.bizNetworkConnection.buildQuery('SELECT top.nextnet.gnb.Bid WHERE ( fragment == _$fragID ) ');
			const bids = await this.bizNetworkConnection.query(query, { fragID: "resource:top.nextnet.gnb.ServiceFragment#" + fragment.getIdentifier() });
		}





	}

	/** Listen for the sale transaction events
		  */
	async listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', async (evt) => {

			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewIntentionEvent") {


				var intention = await this.intentionRegistry.get(evt.target.getIdentifier());


				var services = this.generate_services(intention)
				for (let service of services) {
					var service_id = service.getIdentifier();
					service = await this.serviceRegistry.add(service)


					var newServiceEvent = this.factory.newEvent("top.nextnet.gnb", "NewServiceEvent");
					newServiceEvent.target = this.factory.newRelationship("top.nextnet.gnb", "Service", service_id);
					this.bizNetworkConnection.emit(newServiceEvent);
					var publishServiceTransaction = this.factory.newTransaction("top.nextnet.gnb", "PublishService");
					publishServiceTransaction.service = this.factory.newRelationship("top.nextnet.gnb", "Service", service_id);
					await this.bizNetworkConnection.submitTransaction(publishServiceTransaction);
					console.log("a Service has been published " + publishServiceTransaction.getIdentifier());
				};





			}
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentEvent") {
				console.log(util.format("a new fragment for service %s published ", evt.target.getIdentifier()));
			}


		})

	}



}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
