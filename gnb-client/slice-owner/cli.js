
var userName = process.argv[2] ? process.argv[2] : "admin"
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
let cardname = userName + '@gnb';
this.bizNetworkConnection = new BusinessNetworkConnection();
this.businessNetworkDefinition = null
this.bizNetworkConnection.connect(cardname).then(value => {
    this.businessNetworkDefinition = value;
    this.bizNetworkConnection.getAssetRegistry("top.nextnet.gnb.Intention").then(intentionRegistry => {
	intentionRegistry.getAll().then( intentions => { 
		for (let i of intentions){
 			console.log(i.getIdentifier()+"@"+i.owner.getIdentifier());
		}
	})
   })

}).catch( err => console.log(err));
