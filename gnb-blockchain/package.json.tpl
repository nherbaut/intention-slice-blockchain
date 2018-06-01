{
  "engines": {
    "composer": "^0.19.5"
  },
  "name": "gnb",
  "version": "0.0.TPL_VERSION",
  "description": "gnb",
  "scripts": {
    "prepublish": "mkdirp ./dist && composer archive create --sourceType dir --sourceName . -a ./dist/gnb.bna",
    "pretest": "npm run lint",
    "lint": "eslint .",
    "test": "nyc mocha -t 0 test/*.js && cucumber-js"
  },
  "keywords": [
    "composer",
    "composer-network"
  ],
  "author": "nicolas herbaut",
  "email": "nicolas.herbaut@gmail.com",
  "license": "Apache-2.0",
  "devDependencies": {
    "composer-admin": "^0.19.5",
    "composer-cli": "^0.19.5",
    "composer-client": "^0.19.5",
    "composer-common": "^0.19.5",
    "composer-connector-embedded": "^0.19.5",
    "composer-cucumber-steps": "^0.19.5",
    "chai": "latest",
    "chai-as-promised": "latest",
    "cucumber": "^2.2.0",
    "eslint": "latest",
    "nyc": "latest",
    "mkdirp": "latest",
    "mocha": "latest"
  }
}
