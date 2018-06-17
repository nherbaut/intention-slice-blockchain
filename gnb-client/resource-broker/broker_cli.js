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
		this.updatedFragments = {}

	}


	get_random_slice(src, dst) {
		var nodes = [0, 2, 3, 11, 5, 7]
		var slice = this.factory.newConcept("top.nextnet.gnb", "TransportSlice")
		slice.src = src;
		slice.dst = dst
		slice.bandwidth = 10
		slice.latency = 200;
		slice.id = uuid().slice(0, 5);

		return slice;

	}
	generate_services(intention) {
		var intentionData = intention.intentionData

		var services = []
		for (let i of [0]) {
			var id = uuid().slice(0, 5);
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


	async arbitrateServiceFragment(fragment, repeatCount) {

		try {

			console.log("arbitrating dirty fragment " + fragment.getIdentifier());

			console.log("arbitration required for fragment " + fragment.getIdentifier());
			var serviceFragmentArbitration = this.factory.newTransaction("top.nextnet.gnb", "ArbitrateServiceFragment");

			serviceFragmentArbitration.fragment = this.factory.newRelationship("top.nextnet.gnb", "ServiceFragment", fragment.getIdentifier());
			console.log("Fragment " + fragment.getIdentifier() + " asked for arbitration");
			var timer = new Date().getTime()
			await this.bizNetworkConnection.submitTransaction(serviceFragmentArbitration);
			console.log("took " + (new Date().getTime() - timer) + " to arbritrate service fragment");

		}
		catch (err) {
			console.log("failed to arbitrate Service Fragment, retrying in 1s");
			this.updatedFragments[fragment.getIdentifier()] = setTimeout(this.arbitrateServiceFragment.bind(this), 1, fragment, 2);

		}

	}



	async arbitrateIntention(intention) {

		try {

			console.log("arbitrating intention " + intention.getIdentifier());
			var arbitrateIntention = this.factory.newTransaction("top.nextnet.gnb", "ArbitrateIntention");

			arbitrateIntention.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());

			await this.bizNetworkConnection.submitTransaction(arbitrateIntention)

			console.log("arbitrating intention " + intention.getIdentifier() + " done ");
		}
		catch (err) {
			console.log("failed to arbitrate intention, retrying in 5s");
			setTimeout(this.arbitrateIntention.bind(this), 5 * 1000, intention);

		}
	}

	/** Listen for the sale transaction events
		  */
	async listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', async (evt) => {

			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewIntentionEvent") {

				console.log("new intention received " + evt.target.getIdentifier())
				var intention = await this.intentionRegistry.get(evt.target.getIdentifier());


				var services = this.generate_services(intention)
				for (let service of services) {
					var service_id = service.getIdentifier();
					service = await this.serviceRegistry.add(service)


					var newServiceEvent = this.factory.newEvent("top.nextnet.gnb", "NewServiceEvent");
					newServiceEvent.target = this.factory.newRelationship("top.nextnet.gnb", "Service", service_id);
					//this.bizNetworkConnection.emit(newServiceEvent);
					var publishServiceTransaction = this.factory.newTransaction("top.nextnet.gnb", "PublishService");
					publishServiceTransaction.service = this.factory.newRelationship("top.nextnet.gnb", "Service", service_id);
					await this.bizNetworkConnection.submitTransaction(publishServiceTransaction);
					console.log("a Service has been published " + publishServiceTransaction.getIdentifier());
				};


				setTimeout(this.arbitrateIntention.bind(this), 60 * 1000, intention);


			}
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentEvent") {
				console.log("New service Fragment " + evt.target.getIdentifier())
				if (this.updatedFragments[evt.target.getIdentifier()] == undefined || this.updatedFragments[evt.target.getIdentifier()]._called == true) {
					console.log(" adding a new timeout for Fragment " + evt.target.getIdentifier());
					this.updatedFragments[evt.target.getIdentifier()] = setTimeout(this.arbitrateServiceFragment.bind(this), 1 * 1000, evt.target, 2);
				}
				else {
					console.log("Fragment Event > Timeout already active for " + evt.target.getIdentifier())

				}

			}
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.PlaceBidEvent") {
				console.log("fragment " + evt.target.fragment.getIdentifier() + " will be arbitrated");
				if (this.updatedFragments[evt.target.fragment.getIdentifier()] == undefined || this.updatedFragments[evt.target.fragment.getIdentifier()]._called == true) {
					console.log(" adding a new timeout for Fragment " + evt.target.fragment);
					this.updatedFragments[evt.target.getIdentifier()] = setTimeout(this.arbitrateServiceFragment.bind(this), 1 * 1000, evt.target.fragment, 2);
				}
				else {
					console.log("BidEvent > Timeout already active for " + evt.target.fragment.getIdentifier())

				}

			}

		})

	}



}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
