import Section from "../models/Section.model.js";

export const getAllSections = async(req, res) => {
    try{
        const sections = await Section.find({});
        res.status(200).json({ success: true, data : sections});
    } catch(error){
        res.status(500).json({ success: false, message: "Server Error"});
    }
};

export const createSection = async(req, res) => {
    const section = req.body; // user will send this data by api

    if(!section.title || !section.content || !section.question_groups){
        return res.status(400).json({ success: false, message: "Please provide all info"});
    }

    const newSection = new Section(section);

    try{
        await newSection.save();
        res.status(201).json({ success: true, data : newSection });
    }
    catch(error){
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSectionById = async(req, res) => {
    const { id } = req.params;
    try {
        const section = await Section.findById(id);
        if (!section) {
            return res.status(404).json({ success: false, message: "Section not found" });
        }
        res.status(200).json({ success: true, data: section });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateSection = async(req, res) => {
    const { id } = req.params;
    const section = req.body;

    try {
        const updatedSection = await Section.findByIdAndUpdate(id, section, { new: true });
        if (!updatedSection) {
            return res.status(404).json({ success: false, message: "Section not found" });
        }
        res.status(200).json({ success: true, data: updatedSection });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deleteSection = async(req, res) => {
    const { id } = req.params;
    try{
        await Section.findByIdAndDelete(id);
        res.status(201).json({ success: true, message: "Delete Success"});
    } catch (error){
        res.status(404).json({ success: false, message: "Can not find and delete"});
    }
};