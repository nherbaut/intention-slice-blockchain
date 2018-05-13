VERSION=`sed -e 's/^"//' -e 's/"$//' <<< $(jq ".version" package.json )`
NAME=`sed -e 's/^"//' -e 's/"$//' <<< $(jq ".name" package.json )`
echo "upgrading $NAME to $VERSION"
 
composer archive create -t dir -n .
composer network  install --card PeerAdmin@hlfv1 --archiveFile gnb@$VERSION.bna
composer network upgrade  --networkName $NAME --networkVersion $VERSION  --card PeerAdmin@hlfv1 