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
		this.intentionRegistry = await this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Intention");
	}





	/** Listen for the sale transaction events
		  */
	listen() {
		console.log("listening to events")
		this.bizNetworkConnection.on('event', (evt) => {

			if (evt.getFullyQualifiedType() == "top.nextnet.gnb.NewIntentionEvent") {


				this.intentionRegistry.getAll().then( all => { console.log(all)});

				this.intentionRegistry.get(evt.target.getIdentifier()).then(
					intention => { console.log(intention.getIdentifier()); }
				)

			}

		});
	}


}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
