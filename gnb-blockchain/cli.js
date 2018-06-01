#!/usr/bin/env node

'use strict';


function handle_new_intention_event(event){
    console.log(event.getFullyQualifiedType())
}

const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
let cardname = 'admin@gnb';
this.bizNetworkConnection = new BusinessNetworkConnection();
this.businessNetworkDefinition = null
this.bizNetworkConnection.connect(cardname).then(value => { 
    this.businessNetworkDefinition = value;
    this.bizNetworkConnection.on('event', (evt) => 
    {
        
        if( evt.getFullyQualifiedType()=="top.nextnet.gnb.NewIntentionEvent"){
            
            handle_new_intention_event(evt)
        }
        
    });
    
});

