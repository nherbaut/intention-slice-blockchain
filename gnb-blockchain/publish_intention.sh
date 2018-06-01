ID=$RANDOM
ID_INT=$RANDOM
curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d "{     \"$class\": \"top.nextnet.gnb.SliceOwner\",  \"sliceOwnerId\": \"SL$ID\",  \"name\": \"SL$ID\"  }" 'http://localhost:3000/api/SliceOwner'
echo "\n"
curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d "{     \"$class\": \"top.nextnet.gnb.Intention\",     \"public\": \"false\",     \"intentionId\": \"$ID_INT\",     \"intentionData\": \"string\",     \"owner\": \"top.nextnet.gnb.SliceOwner#$ID\"}" 'http://localhost:3000/api/Intention'
echo "\n"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d "{     \"$class\": \"top.nextnet.gnb.PublishIntention\",     \"target\": \"top.nextnet.gnb.Intention#$ID_INT\"   }" 'http://localhost:3000/api/PublishIntention'
