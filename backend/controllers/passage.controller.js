import Passage from "../models/Passage.model.js";

export const getAllPassages = async(req, res) => {
    try{
        const passages = await Passage.find({});
        res.status(200).json({ success: true, data : passages});
    } catch(error){
        res.status(500).json({ success: false, message: "Server Error"});
    }
};

export const createPassage = async(req, res) => {
    const passage = req.body; // user will send this data by api

    if(!passage.title || !passage.content || !passage.question_groups){
        return res.status(400).json({ success: false, message: "Please provide all info"});
    }

    const newPassage = new Passage(passage);

    try{
        await newPassage.save();
        res.status(201).json({ success: true, data : newPassage });
    }
    catch(error){
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPassageById = async(req, res) => {
    const { id } = req.params;
    try {
        const passage = await Passage.findById(id);
        if (!passage) {
            return res.status(404).json({ success: false, message: "Passage not found" });
        }
        res.status(200).json({ success: true, data: passage });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updatePassage = async(req, res) => {
    const { id } = req.params;
    const passage = req.body;

    try {
        const updatedPassage = await Passage.findByIdAndUpdate(id, passage, { new: true });
        if (!updatedPassage) {
            return res.status(404).json({ success: false, message: "Passage not found" });
        }
        res.status(200).json({ success: true, data: updatedPassage });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deletePassage = async(req, res) => {
    const { id } = req.params;
    try{
        await Passage.findByIdAndDelete(id);
        res.status(201).json({ success: true, message: "Delete Success"});
    } catch (error){
        res.status(404).json({ success: false, message: "Can not find and delete"});
    }
};