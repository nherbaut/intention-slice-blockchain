

set -x
ID=$1
ID_INT=$2


#create participant if it's not already there
if [[ $(composer card list -q |grep "^SO.*") != *NicoClient* ]]; then 

composer participant add  -d "{ \"\$class\": \"top.nextnet.gnb.SliceOwner\",  \"id\": \"SO$ID\" }" -c "admin@gnb" 
composer identity issue -c admin@gnb -f so$ID.card -u SO$ID -a "resource:top.nextnet.gnb.SliceOwner#SO$ID"
composer card  import -f ./so$ID.card

fi

composer transaction submit --card SO$ID@gnb -d "{\"\$class\": \"org.hyperledger.composer.system.AddAsset\", \"targetRegistry\": \"resource:org.hyperledger.composer.system.AssetRegistry#top.nextnet.gnb.Intention\", \"resources\": [{     \"\$class\": \"top.nextnet.gnb.Intention\",     \"public\": \"false\",     \"intentionId\": \"$ID_INT\",     \"intentionData\": \"string\",     \"owner\": \"top.nextnet.gnb.SliceOwner#SO$ID\"}]}"


composer transaction submit --card SO$ID@gnb -d "{\"\$class\": \"top.nextnet.gnb.PublishIntention\", \"target\": \"resource:top.nextnet.gnb.Intention#$ID_INT\"}"
