'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const winston = require('winston');
var chalk = require('chalk');
let config = require('config').get('event-app');
const LOG = winston.loggers.get('application');
let cardname=config.get('cardname');

class SitechainListener{

	constructor() {

        	this.bizNetworkConnection = new BusinessNetworkConnection();
        	
    	}


	init() {
			this.bizNetworkConnection.connect(cardname)	
			
			.then((result) => {
          		this.businessNetworkDefinition = result;
          		//LOG.info(this.businessNetworkDefinition.getIdentifier());
      		})
      		// and catch any exceptions that are triggered
      		.catch(function (error) {
          		throw error;
      		});

    	}


	/** Listen for the sale transaction events
     	*/
     	listen(){
       		this.bizNetworkConnection.on('event',(evt)=>{
         		console.log(evt);
         		let options = {
           			properties: { key:'value'}
         	};
       });
     }


}



var lnr = new SitechainListener();
lnr.init();
lnr.listen()
