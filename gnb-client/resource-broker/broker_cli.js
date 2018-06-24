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
const timeoutSFArbitrate = 1 * 1000;
const timeoutIntentArbitrate = 30 * 1000;

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
		this.bidRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Bid");
		this.factory = await this.bizNetworkConnection.getBusinessNetwork().getFactory();
		this.updatedFragments = new Map();
		this.fragmentTimeouts = new Map();
		this.intentionTimeoutMap = new Map();

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


			service.slices.push(this.get_random_slice("0", "2"));

			service.slices.push(this.get_random_slice("3", "11"));
			service.slices.push(this.get_random_slice("5", "7"));
			service.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());
			services.push(service);
		}

		return services;


	}


	async arbitrateServiceFragment(fragmentId, repeatCount) {

		try {

			var localFragmentData = this.updatedFragments.get(fragmentId);
			if (localFragmentData != undefined && localFragmentData.updated == true) {
				localFragmentData.updated = false;
				var deal = localFragmentData.bestDeal;
				console.log("arbitrating dirty fragment " + fragmentId);
				var serviceFragmentArbitration = this.factory.newTransaction("top.nextnet.gnb", "ArbitrateServiceFragment");
				serviceFragmentArbitration.bestDeal = deal;
				var start = new Date();
				await this.bizNetworkConnection.submitTransaction(serviceFragmentArbitration);
				console.log("took " + (new Date().getTime() - start.getTime()) + " for service Fragment Arbitration" + deal.fragment.getIdentifier());
				//console.log("took " + (new Date().getTime() - timer) + " to arbritrate service fragment");


			}
		}
		catch (err) {
			console.log("failed to arbitrate Service Fragment  " + err);

		}

	}



	async arbitrateIntention(intention) {

		try {

			console.log("arbitrating intention " + intention.getIdentifier());
			var arbitrateIntention = this.factory.newTransaction("top.nextnet.gnb", "ArbitrateIntention");
			arbitrateIntention.intention = this.factory.newRelationship("top.nextnet.gnb", "Intention", intention.getIdentifier());
			await this.bizNetworkConnection.submitTransaction(arbitrateIntention)
			for (var timeout of Array.from(this.intentionTimeoutMap.entries()).filter(entry => entry[1].intention == intention.getIdentifier()).map(entry => entry[0])) {
				clearInterval(timeout);
				this.intentionTimeoutMap.delete(timeout);
			}




			console.log("arbitrating intention " + intention.getIdentifier());
			var winnerIntention = await this.intentionRegistry.get(intention.getIdentifier());
			if (winnerIntention.services.length == 1) {

				var winnserService = await this.serviceRegistry.get(winnerIntention.services[0].getIdentifier());
				var bids = [];

				var bestPrice = 0.0;
				for (let bidId of winnserService.bestBids) {
					var bid = this.bidRegistry.resolve(bidId.getIdentifier());
					bids.push(bid);
					bestPrice += bid.price;
				}
				console.log(" Best price is " + bestPrice);
				bids.map(bid => { bid.fragment }).map(frag => { console.log(frag) });


			}
			else {
				throw new Error("there should be only 1 service after arbitration...")
			}


		}
		catch (err) {
			console.log("failed to arbitrate intention, retrying in 5s, " + err);
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
				this.intentionTimeoutMap.set(intention.getIdentifier(), []);


				var services = this.generate_services(intention);

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


				setTimeout(this.arbitrateIntention.bind(this), timeoutIntentArbitrate, intention);


			}
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentEvent") {
				console.log("New service Fragment " + evt.target.getIdentifier());

				var fragment = evt.target;
				//no timeout so far, we create it
				if (this.intentionTimeoutMap.get(evt.target.getIdentifier()) == undefined) {

					var timeout = setInterval(this.arbitrateServiceFragment.bind(this), timeoutSFArbitrate, fragment.getIdentifier());;
					this.intentionTimeoutMap.set(fragment.getIdentifier(), { intention: fragment.intention.getIdentifier(), timeout: timeout });
				}


				var dummyDeal = this.factory.newConcept("top.nextnet.gnb", "BestFragmentDeal")
				dummyDeal.fragment = this.factory.newRelationship("top.nextnet.gnb", "ServiceFragment", fragment.getIdentifier());
				var status = { bestDeal: dummyDeal, updated: false };


				this.updatedFragments.set(fragment.getIdentifier(), status);



			}
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.PlaceBidEvent") {
				var status = this.updatedFragments.get(evt.target.fragment.getIdentifier())
				if (status == undefined) {//should not happend, since the broker is aware of the new fragment before the providers
					var dummyDeal = this.factory.newConcept("top.nextnet.gnb", "BestFragmentDeal")
					dummyDeal.fragment = this.factory.newRelationship("top.nextnet.gnb", "ServiceFragment", evt.target.fragment.getIdentifier());
					status = { bestDeal: dummyDeal, updated: true }
				}
				else {
					status.updated = true;
				}

				this.updatedFragments.set(evt.target.fragment.getIdentifier(), status);


			}
			else if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewServiceFragmentDealEvent") {
				var deal = evt.target;
				var status = this.updatedFragments.get(deal.fragment.getIdentifier());
				status.bestDeal = deal;



			}

		});

	}



}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
