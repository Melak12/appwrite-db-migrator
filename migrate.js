// Load .env
require("dotenv").config();
const sdk = require("node-appwrite");

const fs = require("fs");
const path = require("path");

let client = new sdk.Client();
const database = new sdk.Database(client);
client
  .setEndpoint(process.env.APPWRITE_API_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
  .setSelfSigned();

const startTime = Date.now();

const migrateDatabase = async () => {
  const collectionsJson = JSON.parse(
    fs.readFileSync("schema/collections.json").toString()
  );

  for (const collection of collectionsJson.collections) {
    const existingAppwriteCollectionId = await (async () => {
      try {
        const appwriteCollection = await database.listCollections(
          collection.name,
        );

        return appwriteCollection.collections[0].$id;
      } catch (err) {
        // Collection not found
        return null;
      }
    })();

    if (existingAppwriteCollectionId) {
      console.warn(`⚠️ Collection ${collection.name} already exists`);

      collectionIdMap[collection.name] = existingAppwriteCollectionId;
    } else {
      console.info(`🍏 Creating collection. ID: ${collection.id} | Name:  ${collection.name} ...`);

      const { $id: collectionId } = await database.createCollection(
        collection.id,
        collection.name,
        'document', //document level permission
        collection.$permissions.read,
        collection.$permissions.write,

      );

      //create attributes
      const stringAttributes = collection.attributes.filter(a => a.type === 'text');
      if(!stringAttributes) stringAttributes = [];

      const numberAttributes = collection.attributes.filter(a => a.type === 'integer');
      if(!numberAttributes) numberAttributes = [];

      const urlAttributes = collection.attributes.filter(a => a.type === 'url');
      if(!urlAttributes) urlAttributes = [];

      const enumAttributes = collection.attributes.filter(a => a.type === 'enum');
      if(!enumAttributes) enumAttributes = [];

      await Promise.all([
        console.info('Create Attributes for ', collection.id),
        //create string attributes
        stringAttributes.forEach(attr => {
          database.createStringAttribute(collection.id, attr.key, attr.size, attr.required, attr.default, attr.array);
        }),

        //create integer attributes
        numberAttributes.forEach(attr => {
          database.createIntegerAttribute(collection.id, attr.key, attr.required, attr.default, null, null, attr.array);
        }),

        //create url attributes
        urlAttributes.forEach(attr => {
          database.createUrlAttribute(collection.id, attr.key, attr.required, attr.default, attr.array);
        }),

        //create enum attributes
        enumAttributes.forEach(attr => {
          database.createEnumAttribute(collection.id, attr.key,attr.elements, attr.required, attr.default, attr.array);
        })

      ]);

      //wait for all attributes are created
      //todo: improve this
      await new Promise((pRes) => {
        setTimeout(() => {
         pRes(true);
        }, 5000);
       });


    }
  }
};


// For development purposes
const wipeAppwriteProject = async () => {
  console.log("==== 💼 Wiping database ====");

  // Wipe all collections and functions:
  const collectionsData = await database.listCollections(undefined, 100, 0); // TODO: Pagination
  for (const collection of collectionsData.collections) {
    await database.deleteCollection(collection.$id);
  }
};

(async () => {
  //wipe all data
  //WARNING: use this development enviroment
  await wipeAppwriteProject();

  //wait for project is wiped
  //todo: improve this
  await new Promise((pRes) => {
    setTimeout(() => {
      pRes(true);
    }, 5000);
  });

  console.log("==== 💼 Database migration ====");
  await migrateDatabase();


})()
  .then(() => {

    console.log("Migration finished ✅");

    console.log(
      "❇️ Migraions finished in",
      Math.floor((Date.now() - startTime) / 1000),
      "s"
    );

    process.exit();
  })
  .catch((err) => {
    console.error("Migration failed ❌");
    console.error(err);
    process.exit();
  });


