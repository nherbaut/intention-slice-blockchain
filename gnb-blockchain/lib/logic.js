// /**
// * Track the trade of a commodity from one trader to another
// * @param {top.nextnet.gnb.Trade} trade - the trade to be processed
// * @transaction
// */
//async function tradeCommodity(trade) {
//    trade.commodity.owner = trade.newOwner;
//    let assetRegistry = await getAssetRegistry('top.nextnet.gnb.Commodity');
//    await assetRegistry.update(trade.commodity);
//}

/**
 * bla
 * @param {top.nextnet.gnb.PublishIntention} intention
 * @transaction
 */
async function intentionPublicationProcessor(intention) {

    var factory = getFactory();
    
    var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewIntentionEvent');
    basicEvent.message = "emiting intention"
    emit(basicEvent);
    console.log(basicEvent)

    let intentionRegistry = await getAssetRegistry("top.nextnet.gnb.Intention");
    
    intention.target.public = true
    await intentionRegistry.update(intention.target)
    basicEvent.message = "intention emited"
    emit(basicEvent)
    console.log(basicEvent)






}