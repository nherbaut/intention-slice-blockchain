VERSION=`sed -e 's/^"//' -e 's/"$//' <<< $(jq ".version" package.json )`
NAME=`sed -e 's/^"//' -e 's/"$//' <<< $(jq ".name" package.json )`

composer network install --card PeerAdmin@hlfv1 --archiveFile $NAME@$VERSION.bna 
composer network start --networkName $NAME --networkVersion $VERSION --networkAdmin admin --networkAdminEnrollSecret adminpw --card PeerAdmin@hlfv1 --file networkadmin.card
composer card import --file networkadmin.card
composer network ping --card admin@gnb

