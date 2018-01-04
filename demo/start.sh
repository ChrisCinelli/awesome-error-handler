#! /bin/bash
shopt -s dotglob
yarn
rm -rf ./node_modules/awesome-error-handler
mkdir -p ./node_modules/awesome-error-handler
echo "Coping files"
cp -r ../package.json ../lib ../views ../index.js ../node_modules ./node_modules/awesome-error-handler
echo "Done coping"
npx nodemon index.js