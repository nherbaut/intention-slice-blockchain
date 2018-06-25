
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
    var basicEvent = factory.newEvent('top.nextnet.gnb', 'PlaceBidEvent');
    basicEvent.target = payload.target;
    emit(basicEvent);
}

/**
 * 
 * @param {top.nextnet.gnb.ArbitrateIntention} payload
 * @transaction 
 */
async function ArbitrateIntention(payload) {
    var i = 0;
    console.log("arbitrate intention");
    var factory = getFactory();
    //get all service for this intention
    let intentionRegistry = await getAssetRegistry("top.nextnet.gnb.Intention");


    var intentionId = payload.intention.getIdentifier();
    var intention = await intentionRegistry.get(intentionId);
    const aquery = buildQuery('SELECT top.nextnet.gnb.Service WHERE ( intention == _$intention )');
    const services = await query(aquery, { intention: "resource:top.nextnet.gnb.Intention#" + intentionId });
    var dummyDeal = factory.newConcept("top.nextnet.gnb", "BestFragmentDeal");

    var bestIntentionPrice = 99999999;
    var bestService = undefined;

    for (let service of services) {

        var bestServicePrice = 99999999;


        //for each service, get the best fragment
        const bquery = buildQuery('SELECT top.nextnet.gnb.ServiceFragment WHERE ( service == _$service )');

        const fragments = await query(bquery, { service: "resource:top.nextnet.gnb.Service#" + service.getIdentifier() });

        var combinedFragments = [...subsets(fragments)];

        var winningServiceCombi = undefined;
        each_combi:
        for (let candidate of combinedFragments) {

            var candidateReduced = [];

            loop1:
            for (let candidate_fragment of candidate) {

                for (let slice of candidate_fragment.slices) {

                    if (-1 == (candidateReduced.indexOf(slice.id))) {

                        candidateReduced.push(slice.id);
                    }
                    else {

                        continue each_combi
                    }
                }
            }
            //if the combination covers all the service
            if (candidateReduced.length == service.slices.length) {


                var flatCombi = [].concat(...candidate);
                var flatCombiArbitrated = []

                var combiPrice = 0;
                //for each fragment in the combination
                for (let fragment of flatCombi) {


                    //get the best price for the fragment
                    dummyDeal.fragment = factory.newRelationship("top.nextnet.gnb", "ServiceFragment", fragment.getIdentifier());

                    var deal = await _arbitrateServiceFragment(dummyDeal);
                    if (deal == undefined) {
                        console.log("Damn, no deal for " + fragment.getIdentifier());

                        continue each_combi;
                    }

                    combiPrice += deal.bestPrice;
                    flatCombiArbitrated.push(deal);
                }

                combiPrice = flatCombiArbitrated.reduce((acc, deal) => acc + deal.bestPrice, 0);


                console.log(" The comglomerate of " + flatCombiArbitrated.reduce((acc, deal) => acc + deal.fragment.getIdentifier() + " ", " ") + " is worht" + combiPrice);

                if (bestServicePrice > combiPrice) {
                    bestServicePrice = combiPrice;
                    winningServiceCombi = flatCombiArbitrated;

                }


            }




            //await serviceRegistry.update(service);


            if (bestServicePrice < bestIntentionPrice) {
                bestService = service;
                bestIntentionPrice = bestServicePrice;

                bestService.bestBids = []
                for (let deal of winningServiceCombi) {

                    bestService.bestBids.push(factory.newRelationship("top.nextnet.gnb", "Bid", deal.bestBid.getIdentifier()));
                }
            }

        }

    }


    if (bestService != undefined) {
        //?await serviceRegistry.update(bestService);

        let serviceRegistry = await getAssetRegistry("top.nextnet.gnb.Service");

        await serviceRegistry.update(bestService);

        let intentionRepository = await getAssetRegistry("top.nextnet.gnb.Intention");

        intention.arbitrated = true;

        intention.services = [factory.newRelationship("top.nextnet.gnb", "Service", bestService.getIdentifier())]

        await intentionRepository.update(intention);

        var basicEvent = factory.newEvent('top.nextnet.gnb', 'IntentionResolvedEvent');
        basicEvent.intention = factory.newRelationship('top.nextnet.gnb', "Intention", intention.getIdentifier());

        emit(basicEvent);
    }


}

async function _arbitrateServiceFragment(bestDeal) {

    var i = 0;

    var bestBid;
    if (bestDeal == undefined) {
        console.log("weird");
    }
    let fragmentId = bestDeal.fragment.getIdentifier();
    try {
        var factory = getFactory();
        const aquery = buildQuery('SELECT top.nextnet.gnb.Bid WHERE ( fragment == _$fragID AND obsolete==false)');
        var start = new Date();
        const bids = await query(aquery, { fragID: "resource:top.nextnet.gnb.ServiceFragment#" + fragmentId });
        console.log("NHE bid query" + (new Date().getTime() - start.getTime()));


        var bestPrice = bestDeal.bestPrice;
        var betterCompetitor = bestDeal.bestRP;

        for (let bid of bids) {
            if (bid.price < bestPrice) {
                betterCompetitor = bid.owner;
                bestPrice = bid.price;
                bestBid = bid;

            }
            else {
                bid.obsolete = true;

            }
        }

        //let bidRegistry = await getAssetRegistry("top.nextnet.gnb.Bid");
        //await bidRegistry.updateAll(bids);
        if (betterCompetitor != bestDeal.bestRP) {

            if (bestPrice == bestDeal.bestPrice) {
                throw new Error("should not happen");
            }

            var deal = factory.newConcept("top.nextnet.gnb", "BestFragmentDeal")
            deal.bestPrice = bestPrice
            deal.bestRP = factory.newRelationship("top.nextnet.gnb", "ResourceProvider", betterCompetitor.getIdentifier());
            deal.fragment = factory.newRelationship("top.nextnet.gnb", "ServiceFragment", fragmentId);
            deal.bestBid = factory.newRelationship("top.nextnet.gnb", "Bid", bestBid.getIdentifier());


            return deal;

        }


    }
    catch (err) {
        console.log("the problem is here " + err);
        console.log(err.stack)
    }

    console.log("failed to computer price for segment");
    return undefined;

}
/**
 * 
 * @param {top.nextnet.gnb.ArbitrateServiceFragment} payload
 * @transaction 
 */
async function arbitrateServiceFragment(payload) {
    var factory = getFactory();



    var start = new Date();
    var deal = await _arbitrateServiceFragment(payload.bestDeal);
    console.log("NHE arbitrateServuceFragment _" + (new Date().getTime() - start.getTime()));


    if (deal != undefined) {

        var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewServiceFragmentDealEvent');
        basicEvent.target = deal;
        emit(basicEvent);
        console.log("NHE " + new Date().getTime() + " > new deal for " + deal.fragment.getIdentifier() + " was published")
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

        if (slice_requests == undefined || slice_requests.length == 0) {
            continue;
        }
        var fragment = factory.newResource("top.nextnet.gnb", "ServiceFragment", payload.service.getIdentifier() + "_" + id)
        fragment.slices = []
        for (let slice of slice_requests) {
            fragment.slices.push(slice);

        }
        fragment.service = factory.newRelationship("top.nextnet.gnb", "Service", payload.service.getIdentifier());

        fragments.push(fragment);
        fragment.intention = factory.newRelationship("top.nextnet.gnb", "Intention", payload.service.intention.getIdentifier());
        await serviceFragmentRegistry.add(fragment);

        var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewServiceFragmentEvent');

        basicEvent.target = fragment;

        emit(basicEvent);
    }


}
