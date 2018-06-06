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
    console.log(basicEvent)

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
 * @param {top.nextnet.gnb.PublishService} service
 * @transaction
 */
async function servicePublicationProcessor(service) {

    var factory = getFactory();


    let serviceFragmentRegistry = await getAssetRegistry("top.nextnet.gnb.ServiceFragment");
    fagments = []
    for (let entry of subsets(service.slices).entries()) {
        [id, slice_reqeusts] = entry
        fagment = factory.newResource("top.nextnet.gnb", "SliceFragment", service.getIdentifier() + "_" + id)
        fragment.slices = []
        for (let slice in slice_reqeusts) {
            frament.slices.push((factory.newRelationship('top.nextnet.gnb', slice.getType(), slice.getIdentifier()));
        }

        fagments.push(framgment);
    }

    await serviceFragmentRegistry.addAll(fragments);
    for (let fragment of fragments) {

        var basicEvent = factory.newEvent('top.nextnet.gnb', 'NewServiceFragmentEvent');
        basicEvent.target = factory.newRelationship('top.nextnet.gnb', "ServiceFragment", fragment.getIdentifier);
        emit(basicEvent);

    }

}
