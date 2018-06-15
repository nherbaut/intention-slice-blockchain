#!/usr/bin/env node

'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const winston = require('winston');
var yaml = require('js-yaml');
const util = require('util');
const AwaitLock = require("await-lock");
var fs = require('fs');
var _ = require('underscore');
var rn = require('random-number');
var chalk = require('chalk');
var promiseRetry = require('promise-retry');
const uuid = require('uuid/v4');
let config = require('config').get('event-app');
const LOG = winston.loggers.get('application');
let cardname = config.get('cardname');
let lock = new AwaitLock();
var rnoptions = {
	min: 0
	, max: 10000
	, integer: true
}

class BidCounter {
	constructor() {
		this.letcounter = 0;
		this.timeout = new Date();
	}
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
		setInterval(this.arbitrateServiceFragments.bind(this), 20 * 1000);

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
			service.lastUpdate = new Date();
			service.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());
			services.push(service);
		}

		return services;


	}


	async arbitrateServiceFragments() {


		const query = this.bizNetworkConnection.buildQuery('SELECT top.nextnet.gnb.ServiceFragment WHERE ( obsolete == false AND _$timeout<lastUpdate  ) ');
		this.bizNetworkConnection.query(query, { timeout: new Date(new Date().getTime() - 60 * 1000) }).then(fragments => {

			for (let fragment of fragments) {

				console.log("checking bids for " + fragment.getIdentifier());
				const query = this.bizNetworkConnection.buildQuery('SELECT top.nextnet.gnb.Bid WHERE ( obsolete == false AND fragment==_$fragment  ) ');
				this.bizNetworkConnection.query(query, { fragment: "resource:top.nextnet.gnb.ServiceFragment#" + fragment.getIdentifier() }).then(bids => {

					if ((bids.length == 1 && fragment.bestBid != undefined) || bids.length > 0) {
						console.log("arbitration required for fragment " + fragment.getIdentifier());
						var serviceFragmentArbitration = this.factory.newTransaction("top.nextnet.gnb", "ArbitrateServiceFragment");

						serviceFragmentArbitration.fragment = this.factory.newRelationship("top.nextnet.gnb", "ServiceFragment", fragment.getIdentifier());
						this.bizNetworkConnection.submitTransaction(serviceFragmentArbitration).then(console.log("Fragment " + fragment.getIdentifier() + " asked for arbitration"));

					}
					else {
						console.log("no new bids for fragment " + fragment.getIdentifier());
					}

				});
			}
		});

		console.log("arbitrateServiceFragments done");

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
					var publishfragmentfragmentfragmentServiceTransaction = this.factory.newTransaction("top.nextnet.gnb", "PublishService");
					publishServiceTransaction.service = this.factory.newRelationship("top.nextnet.gnb", "Service", service_id);
					await this.bizNetworkConnection.submitTransaction(publishServiceTransaction);
					console.log("a Service has been published " + publishServiceTransaction.getIdentifier());
				};





			}


		})

	}



}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
