
import mongoose, { connect } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();


const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

export const connectDB = async function run() {
  try {
    // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Database connection failed", error);
    process.exit(1);
  }   
}


