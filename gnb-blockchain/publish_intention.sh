

set -x
ID_INT=$RANDOM


#create participant if it's not already there
if [[ $(composer card list -q |grep "^SO.*") != *NicoClient* ]]; then 

composer participant add  -d "{ \"\$class\": \"top.nextnet.gnb.SliceOwner\",  \"id\": \"SONicoClient\" }" -c "admin@gnb" 
composer identity issue -c admin@gnb -f soNicoClient.card -u SONicoClient -a "resource:top.nextnet.gnb.SliceOwner#SONicoClient"
composer card  import -f ./soNicoClient.card

fi

composer transaction submit --card SONicoClient@gnb -d "{\"\$class\": \"org.hyperledger.composer.system.AddAsset\", \"targetRegistry\": \"resource:org.hyperledger.composer.system.AssetRegistry#top.nextnet.gnb.Intention\", \"resources\": [{     \"\$class\": \"top.nextnet.gnb.Intention\",     \"public\": \"false\",     \"intentionId\": \"$ID_INT\",     \"intentionData\": \"string\",     \"owner\": \"top.nextnet.gnb.SliceOwner#SONicoClient\"}]}"


composer transaction submit --card SONicoClient@gnb -d "{\"\$class\": \"top.nextnet.gnb.PublishIntention\", \"target\": \"resource:top.nextnet.gnb.Intention#$ID_INT\"}"
