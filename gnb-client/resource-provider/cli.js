'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const winston = require('winston');
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

		setInterval(this.updatedb.bind(this), 5000);

	}


	async updatedb() {
		console.log("updating db");

		var rps = await this.rpRegistry.getAll();
		var rp = rps[0];
		if (rp.resources != undefined) {
			for (let r of rp.resources) {
				console.log(r.getIdentifier())
			}
		}


		let factory = this.businessNetworkDefinition.getFactory();
		let rand_int = rn(rnoptions)
		let tr = factory.newResource('top.nextnet.gnb', 'TransportResource', "" + rand_int);
		tr.src = "a"
		tr.dst = "b"
		tr.delay = 10
		tr.latency = 20
		tr.price = 0
		await this.transportResourceRegistry.add(tr);
		rp.resources.push(factory.newRelationship('top.nextnet.gnb', 'TransportResource', "" + rand_int));
		await this.rpRegistry.update(rp)


	}


	/** Listen for the sale transaction events
     	*/
	listen() {
		this.bizNetworkConnection.on('event', (evt) => {
			console.log(evt);
			let options = {
				properties: { key: 'value' }
			};
		});
	}


}



var lnr = new SitechainListener();
lnr.init().then(
	res => { lnr.listen() });
