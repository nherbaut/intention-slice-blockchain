#!/usr/bin/env node

'use strict';

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
let cardname = 'admin@gnb';
this.bizNetworkConnection = new BusinessNetworkConnection();
this.businessNetworkDefinition = null
this.bizNetworkConnection.connect(cardname).then(value => { this.businessNetworkDefinition = value;


    this.bizNetworkConnection.on('top.nextnet.gnb.NewIntentionEvent', (evt) => {
        console.log(evt.message);
    });
    
});
