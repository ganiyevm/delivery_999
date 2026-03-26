require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');

const coords = [
    { number: 1,  lat: 41.3135, lng: 69.3537 },
    { number: 2,  lat: 41.3399, lng: 69.3126 },
    { number: 3,  lat: 41.2782, lng: 69.2104 },
    { number: 4,  lat: 41.2741, lng: 69.2012 },
    { number: 5,  lat: 41.3092, lng: 69.2771 },
    { number: 6,  lat: 41.3486, lng: 69.3091 },
    { number: 7,  lat: 41.2952, lng: 69.2720 },
    { number: 8,  lat: 41.3065, lng: 69.2793 },
    { number: 9,  lat: 41.3261, lng: 69.3326 },
    { number: 10, lat: 41.3282, lng: 69.3421 },
    { number: 11, lat: 41.3643, lng: 69.2933 },
    { number: 12, lat: 41.3195, lng: 69.3612 },
    { number: 14, lat: 41.3017, lng: 69.2647 },
    { number: 15, lat: 41.3512, lng: 69.3154 },
    { number: 16, lat: 41.3567, lng: 69.3230 },
    { number: 17, lat: 41.2157, lng: 69.2832 },
    { number: 18, lat: 41.3318, lng: 69.3598 },
    { number: 19, lat: 41.3201, lng: 69.3702 },
    { number: 20, lat: 41.3658, lng: 69.3045 },
];

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const c of coords) {
        await Branch.updateOne({ number: c.number }, { $set: { location: { lat: c.lat, lng: c.lng } } });
        console.log(`✅ A${c.number} yangilandi`);
    }
    console.log('Hammasi tayyor!');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
