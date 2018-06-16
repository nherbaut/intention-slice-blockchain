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

		this.serviceFragmentArbitrationRunning = false;
		setInterval(this.arbitrateServiceFragments.bind(this), 5 * 1000);

		this.intentionArbitrationRunning = false;
		setInterval(this.arbitrateIntentions.bind(this), 5 * 1000);

	}


	get_random_slice(src, dst) {
		var nodes = [0, 2, 3, 11, 5, 7]
		var slice = this.factory.newConcept("top.nextnet.gnb", "TransportSlice")
		slice.src = src;
		slice.dst = dst
		slice.bandwidth = 10
		slice.latency = 200;
		slice.id = uuid();

		return slice;

	}
	generate_services(intention) {
		var intentionData = intention.intentionData

		var services = []
		for (let i of [0, 1]) {
			var id = uuid().replace("-", "");
			var service = this.factory.newResource("top.nextnet.gnb", "Service", id);
			service.serviceId = id
			service.slices = []
			service.bestFragments = []

			service.slices.push(this.get_random_slice("0", "2"));

			service.slices.push(this.get_random_slice("3", "11"));
			service.slices.push(this.get_random_slice("5", "7"));
			service.public = true;
			service.lastUpdate = new Date();
			service.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());
			services.push(service);
		}

		return services;


	}


	async arbitrateServiceFragments() {


		if (!this.serviceFragmentArbitrationRunning) {

			this.serviceFragmentArbitrationRunning = true
			const query = this.bizNetworkConnection.buildQuery('SELECT top.nextnet.gnb.ServiceFragment WHERE ( obsolete == false AND _$timeout<lastUpdate  ) ');
			this.bizNetworkConnection.query(query, { timeout: new Date(new Date().getTime() - 60 * 1000) }).then(fragments => {

				for (let fragment of fragments) {

					//saving on transaction issuing when no new bid is published
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
			this.serviceFragmentArbitrationRunning = false;
		}

	}



	async arbitrateIntentions() {


		if (!this.intentionArbitrationRunning) {
			this.intentionArbitrationRunning = true;
			var query = this.bizNetworkConnection.buildQuery('SELECT top.nextnet.gnb.Intention WHERE ( arbitrated == false  ) ');
			this.bizNetworkConnection.query(query).then(async intentions => {


				for (let intention of intentions) {

					var arbitrateIntention = this.factory.newTransaction("top.nextnet.gnb", "ArbitrateIntention");

					arbitrateIntention.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());

					await this.bizNetworkConnection.submitTransaction(arbitrateIntention)

				}
			});

			console.log("arbitrateIntention done");
			this.intentionArbitrationRunning = false;
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
					this.bizNetworkConnection.submitTransaction(publishServiceTransaction);
					console.log("a Service has been published " + publishServiceTransaction.getIdentifier());
				};





			}


		})

	}



}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
