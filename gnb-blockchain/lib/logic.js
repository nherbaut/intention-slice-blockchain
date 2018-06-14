
/**
 * bla
 * @param {top.nextnet.gnb.PublishIntention} intention
 * @transaction
 */
async function intentionPublicationProcessor(intention) {

    var factory = getFactory();

    var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewIntentionEvent');


    let intentionRegistry = await getAssetRegistry("top.nextnet.gnb.Intention");

    intention.target.public = true
    await intentionRegistry.update(intention.target)
    basicEvent.message = "intention emited"
    basicEvent.target = intention.target
    emit(basicEvent)


}

//https://stackoverflow.com/questions/42773836/how-to-find-all-subsets-of-a-set-in-javascript
function* subsets(array, offset = 0) {

    while (offset < array.length) {
        let first = array[offset++];
        for (let subset of subsets(array, offset)) {
            subset.push(first);
            yield subset;
        }
    }

    yield [];

}

/**
 * bla
 * @param {top.nextnet.gnb.PlaceBid} payload 
 * @transaction
 */
async function placeBidProcessor(payload) {

    var factory = getFactory();

    let serviceFragmentRegistry = await getAssetRegistry("top.nextnet.gnb.ServiceFragment");
    let bidRegistry = await getAssetRegistry("top.nextnet.gnb.Bid");
    var fragment = await serviceFragmentRegistry.get(payload.target.fragment.getIdentifier());


    if (fragment.hasOwnProperty("bestPrice")) {

        if (payload.target.price > fragment.bestPrice) {
            return; //return error
        }

    }

    await bidRegistry.add(payload.target);



    /*
    await serviceFragmentRegistry.update(fragment);
    var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewServiceFragmentEvent');
    basicEvent.target = factory.newRelationship('top.nextnet.gnb', "ServiceFragment", fragment.getIdentifier());
    basicEvent.message = "new Service Fragment"
    emit(basicEvent);*/
}

/**
 * 
 * @param {top.nextnet.gnb.ArbitrateServiceFragment} payload
 * @transaction 
 */
async function arbitrateServiceFragment(payload) {
    var factory = getFactory();

    const aquery = buildQuery('SELECT top.nextnet.gnb.Bid WHERE ( fragment == _$fragID AND obsolete==false)');
    const bids = await query(aquery, { fragID: "resource:top.nextnet.gnb.ServiceFragment#" + payload.fragment.getIdentifier() });
    var bestPrice = 99999999;

    let bidRegistry = await getAssetRegistry("top.nextnet.gnb.Bid");

    var bestBid = undefined;
    for (let bid of bids) {
        if (bid.price < bestPrice) {
            bestBid = bid;
            bestPrice = bid.price;

        }
        else {
            bid.obsolete = true;
            bidRegistry.update(bid).then(console.log("obsoleted bid " + bid.getIdentifier()));
        }
    }
    if (bestBid != undefined) {
        let serviceFragmentRegistry = await getAssetRegistry("top.nextnet.gnb.ServiceFragment");
        var fragment = await serviceFragmentRegistry.get(payload.fragment.getIdentifier());
        fragment.bestPrice = bestPrice
        fragment.bestBid = factory.newRelationship("top.nextnet.gnb", "Bid", bestBid.getIdentifier());
        fragment.bestRP = factory.newRelationship("top.nextnet.gnb", "ResourceProvider", bestBid.owner.getIdentifier());

        await serviceFragmentRegistry.update(fragment);

        var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewServiceFragmentEvent');
        basicEvent.target = factory.newRelationship('top.nextnet.gnb', "ServiceFragment", fragment.getIdentifier());
        basicEvent.message = "new Service Fragment"
        emit(basicEvent);
    }





}

/**
 * bla
 * @param {top.nextnet.gnb.PublishService} service
 * @transaction
 */
async function servicePublicationProcessor(payload) {



    var factory = getFactory();

    let serviceFragmentRegistry = await getAssetRegistry("top.nextnet.gnb.ServiceFragment");
    fragments = []


    for (let entry of [...subsets(payload.service.slices)].entries()) {



        [id, slice_requests] = entry

        if (slice_requests.length == 0) {
            continue;
        }
        var fragment = factory.newResource("top.nextnet.gnb", "ServiceFragment", payload.service.getIdentifier() + "_" + id)
        fragment.slices = []
        for (let slice of slice_requests) {
            fragment.slices.push(slice);

        }
        fragment.service = factory.newRelationship("top.nextnet.gnb", "Service", payload.service.getIdentifier());

        fragments.push(fragment);
    }

    await serviceFragmentRegistry.addAll(fragments);
    let frags = await serviceFragmentRegistry.getAll()

    for (let fragment of fragments) {

        var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewServiceFragmentEvent');
        basicEvent.target = factory.newRelationship('top.nextnet.gnb', "ServiceFragment", fragment.getIdentifier());
        basicEvent.message = "new Service Fragment"
        emit(basicEvent);

    }

}
