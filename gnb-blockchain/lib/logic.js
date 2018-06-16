
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



    var basicEvent = factory.newEvent('top.nextnet.gnb', 'PlaceBidEvent');
    basicEvent.fragment = factory.newRelationship('top.nextnet.gnb', "ServiceFragment", fragment.getIdentifier());
    basicEvent.target = factory.newRelationship('top.nextnet.gnb', "Bid", payload.target.id);


    basicEvent.message = "new bid"
    emit(basicEvent);
}

/**
 * 
 * @param {top.nextnet.gnb.ArbitrateIntention} payload
 * @transaction 
 */
async function ArbitrateIntention(payload) {
    var factory = getFactory();
    //get all service for this intention
    let intentionRegistry = await getAssetRegistry("top.nextnet.gnb.Intention");
    let serviceRegistry = await getAssetRegistry("top.nextnet.gnb.Service");

    var intentionId = payload.intention.getIdentifier();
    var intention = await intentionRegistry.get(intentionId);
    const aquery = buildQuery('SELECT top.nextnet.gnb.Service WHERE ( intention == _$intention )');
    const services = await query(aquery, { intention: "resource:top.nextnet.gnb.Intention#" + intentionId });

    var bestIntentionPrice = 99999999;
    var bestService = undefined;

    for (let service of services) {

        var bestServicePrice = 99999999;


        //for each service, get the best fragment
        const bquery = buildQuery('SELECT top.nextnet.gnb.ServiceFragment WHERE ( service == _$service )');
        const fragments = await query(bquery, { service: "resource:top.nextnet.gnb.Service#" + service.getIdentifier() });

        var combinedFragments = [...subsets(fragments)];

        for (let candidate of combinedFragments) {
            var candidateReduced = [];
            var validCombi = true;
            loop1:
            for (let candidate_fragments of candidate) {
                for (let slice of candidate_fragments.slices)
                    if (-1 == (candidateReduced.indexOf(slice.id))) {
                        candidateReduced.push(slice.id);
                    }
                    else {
                        validCombi = false;
                        break loop1;
                    }
            }
            if (validCombi && candidateReduced.length == service.slices.length) {
                var flatCombi = [].concat(...candidate);


                var combiPrice = 0;
                for (let item of flatCombi) {
                    console.log(item.getIdentifier() + " costs " + item.bestPrice) + " total " + combiPrice;
                    combiPrice += item.bestPrice;
                }
                console.log("###")
                combiPrice = flatCombi.reduce((acc, fr) => acc + fr.bestPrice, 0);


                console.log(" The comglomerate of " + flatCombi.reduce((acc, fr) => acc + fr.getIdentifier() + " ", " ") + " is worht" + combiPrice);

                if (bestServicePrice > combiPrice) {
                    bestServicePrice = combiPrice;
                    winningServiceCombi = flatCombi;
                }
            }

        }

        if (bestServicePrice < bestIntentionPrice) {
            bestService = service;
            bestIntentionPrice = bestServicePrice;
            service.bestPrice = bestServicePrice;
            service.bestFragments = []
            for (let frag of winningServiceCombi) {
                service.bestFragments.push(factory.newRelationship("top.nextnet.gnb", "ServiceFragment", frag.getIdentifier()))
            }

        }

    }


    await serviceRegistry.update(bestService);


    let intentionRepository = await getAssetRegistry("top.nextnet.gnb.Intention");
    intention.arbitrated = true;
    intention.services = [factory.newRelationship("top.nextnet.gnb", "Service", bestService.getIdentifier())]
    await intentionRepository.update(intention);

    var basicEvent = factory.newEvent('top.nextnet.gnb', 'IntentionResolvedEvent');
    basicEvent.intention = factory.newRelationship('top.nextnet.gnb', "Intention", intention.getIdentifier());

    emit(basicEvent);


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
        fragment.lastUpdate = new Date();
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
        fragment.lastUpdate = new Date();
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
