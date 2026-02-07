import mongoose from 'mongoose';
import Speaking from './models/Speaking.model.js';
import dotenv from 'dotenv';
dotenv.config();

const seedSpeaking = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const sampleTopic = {
      _id: 'speaking_demo_1',
      title: 'Hometown & Background',
      part: 1,
      prompt: 'Let\'s talk about your hometown. Where is your hometown? What do you like most about your hometown? Is there anything you don\'t like about it?',
      sub_questions: [
        'Where is your hometown?',
        'What do you like most about your hometown?',
        'Is there anything you don\'t like about it?'
      ],
      is_active: true
    };

    await Speaking.findOneAndUpdate(
      { _id: sampleTopic._id },
      sampleTopic,
      { upsert: true, new: true }
    );

    console.log('Sample speaking topic seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedSpeaking();
