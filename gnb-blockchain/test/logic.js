/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
/**
 * Write the unit tests for your transction processor functions here
 */

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const namespace = 'top.nextnet.gnb';
const intentionType = 'Intention';
const intentionNS = namespace + '.' + intentionType;
const sliceOwnerType = 'SliceOwner';
const sliceOwnerNS = namespace + '.' + sliceOwnerType;
const resourceProviderType = "ResourceProvider";
const resourceProviderNS = namespace + "." + resourceProviderType


describe('#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore({ type: 'composer-wallet-inmemory' });

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    };

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin';

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection;

    // This is the business network connection the tests will use.
    let businessNetworkConnection;

    // This is the factory for creating instances of types.
    let factory;

    // These are the identities for Alice and Bob.
    const aliceCardName = 'alice';
    const bobCardName = 'bob';

    // These are a list of receieved events.
    let events;

    let businessNetworkName;

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        // Identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: ['PeerAdmin', 'ChannelAdmin']
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);
        const deployerCardName = 'PeerAdmin';

        adminConnection = new AdminConnection({ cardStore: cardStore });

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        };
        const card = new IdCard(metadata, connectionProfile);
        await adminConnection.importCard(cardName, card);
    }

    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        businessNetworkName = businessNetworkDefinition.getName();
        await adminConnection.install(businessNetworkDefinition);
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions);
        await adminConnection.importCard(adminCardName, adminCards.get('admin'));

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', event => {
            events.push(event);
        });
        await businessNetworkConnection.connect(adminCardName);

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        {
            const sliceOwnerRegistry = await businessNetworkConnection.getParticipantRegistry(sliceOwnerNS);
            // Create the participants.
            const alice = factory.newResource(namespace, sliceOwnerType, 'alice@email.com');
            alice.name = 'Alice';


            const bob = factory.newResource(namespace, sliceOwnerType, 'bob@email.com');
            bob.name = 'Bob';


            sliceOwnerRegistry.addAll([alice, bob]);

            const intentionRegistry = await businessNetworkConnection.getAssetRegistry(intentionNS);
            // Create the assets.
            const asset1 = factory.newResource(namespace, intentionType, '1');
            asset1.owner = factory.newRelationship(namespace, sliceOwnerType, 'alice@email.com');
            asset1.intentionData = 'I want a content delivery Service';

            const asset2 = factory.newResource(namespace, intentionType, '2');
            asset2.owner = factory.newRelationship(namespace, sliceOwnerType, 'bob@email.com');
            asset2.intentionData = 'I want a content delivery Service too';

            await intentionRegistry.addAll([asset1, asset2]);





            // Issue the identities.
            let identity = await businessNetworkConnection.issueIdentity(sliceOwnerNS + '#alice@email.com', 'alice1');
            await importCardForIdentity(aliceCardName, identity);
            identity = await businessNetworkConnection.issueIdentity(sliceOwnerNS + '#bob@email.com', 'bob1');
            await importCardForIdentity(bobCardName, identity);


        }
        // Resource Provider instantication

        {
            const resourceProviderRegistry = await businessNetworkConnection.getParticipantRegistry(resourceProviderNS)

            const foo = factory.newResource(namespace, resourceProviderType, "fooCorp");
            await resourceProviderRegistry.add(foo)
            let identityFoo = await businessNetworkConnection.issueIdentity(resourceProviderNS + '#fooCorp', "fooCorp");
            await importCardForIdentity("fooCorp", identityFoo);


            const bar = factory.newResource(namespace, resourceProviderType, "barCorp");
            await resourceProviderRegistry.add(bar)
            let identitybar = await businessNetworkConnection.issueIdentity(resourceProviderNS + '#barCorp', "barCorp");
            await importCardForIdentity("barCorp", identitybar);



        }



    });

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The name of the card for the identity to use
     */
    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect();
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', (event) => {
            events.push(event);
        });
        await businessNetworkConnection.connect(cardName);
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    }

    it('Alice can read only hey intentions', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(intentionNS);
        const assets = await assetRegistry.getAll();

        // Validate the assets.
        assets.should.have.lengthOf(1);
        const asset1 = assets[0];
        asset1.owner.getFullyQualifiedIdentifier().should.equal(sliceOwnerNS + '#alice@email.com');
        asset1.intentionData.should.equal('I want a content delivery Service');

    });

    it('Bob can only access its intentions', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(intentionNS);
        const assets = await assetRegistry.getAll();

        // Validate the assets.
        assets.should.have.lengthOf(1);
        const asset1 = assets[0];
        asset1.owner.getFullyQualifiedIdentifier().should.equal(sliceOwnerNS + '#bob@email.com');
        asset1.intentionData.should.equal('I want a content delivery Service too');

    });

    it("Alice can create an intention", async () => {
        await useIdentity(aliceCardName);

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(intentionNS);

        var factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        var participalRegistry = await businessNetworkConnection.getParticipantRegistry(sliceOwnerNS);

        // Create the vehicle.
        var intention = factory.newResource(namespace, 'Intention', 'Intention1');
        intention.intentionData = "I want 1000 users in Bordeaux from Paris"
        intention.owner = factory.newRelationship(namespace, sliceOwnerType, 'alice@email.com');
        await assetRegistry.add(intention)
        const assets = await assetRegistry.getAll();
        assets.should.have.lengthOf(2);

    });

    it("Publishing the intention changes its public flag", async () => {
        await useIdentity(aliceCardName);

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(intentionNS);

        var factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        var participalRegistry = await businessNetworkConnection.getParticipantRegistry(sliceOwnerNS);

        // Create the vehicle.
        var intention = factory.newResource(namespace, 'Intention', 'Intention3');
        intention.intentionData = "I want 1000 users in Bordeaux from Paris"
        intention.owner = factory.newRelationship(namespace, sliceOwnerType, 'alice@email.com');
        intention.public = false
        await assetRegistry.add(intention)

        let transaction = factory.newTransaction('top.nextnet.gnb', 'PublishIntention');
        transaction.target = factory.newRelationship(namespace, "Intention", 'Intention3');


        await businessNetworkConnection.submitTransaction(transaction);


        var newlyFetchedIntention = await assetRegistry.get("Intention3");
        events.should.have.lengthOf(2);
        events[0].message.should.equal("emiting intention");
        events[1].message.should.equal("intention emited");
        newlyFetchedIntention.public.should.equal(true);





    });





});
