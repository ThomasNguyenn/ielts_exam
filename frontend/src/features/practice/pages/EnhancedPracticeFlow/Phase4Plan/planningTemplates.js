// Essay Planning Templates for IELTS Writing
// Supports both Task 1 and Task 2

export const task1Templates = {
    lineGraph: {
        name: "Line Graph",
        structure: {
            intro: {
                label: "Introduction",
                template: "The [line graph/chart] [illustrates/shows/depicts] [topic] [over/from/between] [time period].",
                tips: "Paraphrase the question. Identify the main trend.",
                example: "The line graph illustrates the consumption of three types of fast food by Australian teenagers between 1975 and 2000."
            },
            overview: {
                label: "Overview",
                template: "Overall, it is clear that [main trend]. Additionally, [secondary observation].",
                tips: "Identify 2-3 most striking features. NO specific numbers here.",
                example: "Overall, it is clear that pizza and hamburgers became increasingly popular, while fish and chips declined in popularity over the period."
            },
            body1: {
                label: "Body Paragraph 1",
                template: "[Group A description] started at [value] in [year] and [increased/decreased/fluctuated] to [value] in [year].",
                tips: "Group similar trends. Use specific data points. Include comparisons.",
                keyPhrases: [
                    "rose from X to Y",
                    "experienced a steady increase",
                    "peaked at X",
                    "reached a high of X"
                ]
            },
            body2: {
                label: "Body Paragraph 2",
                template: "[Group B description]. In contrast/Similarly, [comparison].",
                tips: "Compare/contrast with first group. Highlight key differences.",
                keyPhrases: [
                    "in contrast",
                    "whereas",
                    "on the other hand",
                    "conversely"
                ]
            }
        }
    },
    barChart: {
        name: "Bar Chart",
        structure: {
            intro: {
                label: "Introduction",
                template: "The bar chart compares [categories] in terms of [measurement].",
                tips: "Identify what is being compared and the unit of measurement."
            },
            overview: {
                label: "Overview",
                template: "Overall, [highest category] had the [highest/lowest] [measurement], while [lowest category] recorded the [opposite].",
                tips: "Identify extreme values and notable patterns."
            },
            body1: {
                label: "Body Paragraph 1 - Highest Values",
                template: "[Category A] recorded the highest [measurement] at [value], followed by [Category B] at [value].",
                tips: "Focus on top performers. Make comparisons."
            },
            body2: {
                label: "Body Paragraph 2 - Lower Values/ Comparisons",
                template: "In contrast, [Category C] and [Category D] showed considerably lower figures.",
                tips: "Group similar values together."
            }
        }
    },
    table: {
        name: "Table",
        structure: {
            intro: {
                label: "Introduction",
                template: "The table provides information about [topic] in [categories/countries/years].",
                tips: "State what data is presented"
            },
            overview: {
                label: "Overview",
                template: "It is noticeable that [highest/most significant feature]. Additionally, [secondary pattern].",
                tips: "Identify most significant data points"
            },
            body1: {
                label: "Body Paragraph 1",
                template: "Regarding [first aspect], [highest category] stood at [value], which was [comparison] than [another category] at [value].",
                tips: "Group data logically - by rows, columns, or patterns"
            },
            body2: {
                label: "Body Paragraph 2",
                template: "Turning to [second aspect], a different pattern emerged.",
                tips: "Cover remaining significant data"
            }
        }
    },
    process: {
        name: "Process Diagram",
        structure: {
            intro: {
                label: "Introduction",
                template: "The diagram illustrates [how/the process of] [topic].",
                tips: "Paraphrase the question, mention number of stages if clear"
            },
            overview: {
                label: "Overview",
                template: "Overall, the process consists of [X] main stages, beginning with [first step] and ending with [final step].",
                tips: "Give overall picture - total stages, cyclical or linear"
            },
            body1: {
                label: "Body Paragraph 1 - Early Stages",
                template: "The process begins when/with [first step]. Following this, [second step]. [Third step].",
                tips: "Describe first half of process using sequence words",
                keyPhrases: [
                    "Initially",
                    "The first step involves",
                    "Following this",
                    "Subsequently",
                    "After that"
                ]
            },
            body2: {
                label: "Body Paragraph 2 - Later Stages",
                template: "In the next stage, [step]. Finally, [concluding step].",
                tips: "Complete the description",
                keyPhrases: [
                    "In the subsequent stage",
                    "The next phase involves",
                    "Finally",
                    "Ultimately",
                    "The process concludes with"
                ]
            }
        }
    },
    map: {
        name: "Map/Plan",
        structure: {
            intro: {
                label: "Introduction",
                template: "The [maps/plans] show [location/area] [in two different time periods/how it changed].",
                tips: "Identify what is shown and time comparison if present"
            },
            overview: {
                label: "Overview",
                template: "Overall, the area has undergone [significant/considerable] [development/transformation], with [main change].",
                tips: "Describe overall transformation - more urban, green spaces added, etc."
            },
            body1: {
                label: "Body Paragraph 1 - Main Changes",
                template: "The most noticeable change is the [addition/removal/relocation] of [feature]. [Location description].",
                tips: "Focus on biggest changes. Use positional language.",
                keyPhrases: [
                    "to the north/south/east/west of",
                    "adjacent to",
                    "located in the center",
                    "on the eastern side"
                ]
            },
            body2: {
                label: "Body Paragraph 2 - Additional Changes",
                template: "Furthermore, [other changes]. Additionally, [what remained the same, if relevant].",
                tips: "Cover remaining changes. Mention unchanged features if significant."
            }
        }
    }
};

export const task2Templates = {
    opinion: {
        name: "Opinion (Agree/Disagree)",
        questionPattern: "To what extent do you agree or disagree?",
        structure: {
            intro: {
                label: "Introduction",
                template: "[Paraphrase topic]. I [strongly agree/disagree/partially agree] because [brief reason 1] and [brief reason 2].",
                tips: "State your position clearly in the thesis",
                example: "While technology has brought many benefits, I strongly agree that it has made our lives more complicated because it causes information overload and reduces genuine human interaction."
            },
            body1: {
                label: "Body Paragraph 1",
                template: "Point: [Topic sentence supporting your view]\nExplanation: [Why this is true]\nExample: [Specific example]\nLink: [Connect back to thesis]",
                tips: "Use PEEL structure: Point, Explanation, Example, Link",
                keyPhrases: [
                    "The primary reason is that",
                    "This is because",
                    "For instance",
                    "As a result",
                    "Therefore"
                ]
            },
            body2: {
                label: "Body Paragraph 2",
                template: "[Second supporting point]. [Optional: Address counter-argument briefly if relevant]",
                tips: "Develop second main idea. Can acknowledge opposing view if appropriate."
            },
            conclusion: {
                label: "Conclusion",
                template: "In conclusion, I [restate position] because [summarize main points without repeating].",
                tips: "Rephrase thesis. No new ideas."
            }
        }
    },
    discussion: {
        name: "Discussion + Opinion",
        questionPattern: "Discuss both views and give your own opinion",
        structure: {
            intro: {
                label: "Introduction",
                template: "[Paraphrase topic]. While some believe [view A], others argue that [view B]. This essay will discuss both perspectives before concluding that [your opinion].",
                tips: "Mention both views. Preview your opinion.",
                example: "While some people believe that university education should be free for all, others argue that students should pay fees. This essay will discuss both viewpoints before concluding that a balanced approach with subsidized fees is most effective."
            },
            body1: {
                label: "Body Paragraph 1 - First View",
                template: "On one hand, [group who holds view A] argue that [their reasoning]. [Example]. [Further development].",
                tips: "Present first view fairly, even if you disagree",
                keyPhrases: [
                    "On one hand",
                    "Proponents of X argue that",
                    "Those in favor believe",
                    "It is argued that"
                ]
            },
            body2: {
                label: "Body Paragraph 2 - Second View",
                template: "On the other hand, [view B supporters] contend that [their reasoning]. [Example].",
                tips: "Present opposing view with equal development",
                keyPhrases: [
                    "On the other hand",
                    "Conversely",
                    "However, critics argue",
                    "In contrast"
                ]
            },
            body3: {
                label: "Body Paragraph 3 - Your Opinion (Optional)",
                template: "In my opinion, [your stance]. [Reasoning]. [Example].",
                tips: "Can integrate your opinion in conclusion instead if essay is long enough"
            },
            conclusion: {
                label: "Conclusion",
                template: "In conclusion, while both views have merit, I believe that [your clear position] because [brief justification].",
                tips: "Summarize both views briefly, then state your opinion clearly"
            }
        }
    },
    advantageDisadvantage: {
        name: "Advantages/Disadvantages",
        questionPattern: "Do the advantages outweigh the disadvantages?",
        structure: {
            intro: {
                label: "Introduction",
                template: "[Paraphrase topic]. While there are some [advantages/disadvantages], I believe the [advantages/disadvantages] are more significant.",
                tips: "Make your position clear - which outweighs which"
            },
            body1: {
                label: "Body Paragraph 1 - Advantages",
                template: "There are several advantages to [topic]. Firstly, [advantage 1]. Secondly, [advantage 2].",
                tips: "Present 2-3 clear advantages with explanations",
                keyPhrases: [
                    "One major benefit is",
                    "Furthermore",
                    "Another advantage is",
                    "This leads to"
                ]
            },
            body2: {
                label: "Body Paragraph 2 - Disadvantages",
                template: "However, there are also notable disadvantages. The main drawback is [disadvantage 1]. Additionally, [disadvantage 2].",
                tips: "Present disadvantages objectively",
                keyPhrases: [
                    "However",
                    "The main drawback is",
                    "Additionally",
                    "This can result in"
                ]
            },
            conclusion: {
                label: "Conclusion",
                template: "In conclusion, despite the [disadvantages/advantages] mentioned above, I believe the [advantages/disadvantages] are more compelling because [brief reason].",
                tips: "Clearly state which side outweighs"
            }
        }
    },
    problemSolution: {
        name: "Problem/Solution",
        questionPattern: "What are the problems and what solutions can you suggest?",
        structure: {
            intro: {
                label: "Introduction",
                template: "[Paraphrase topic]. This essay will examine the main problems caused by [topic] and propose some viable solutions.",
                tips: "Acknowledge the issue, preview structure"
            },
            body1: {
                label: "Body Paragraph 1 - Problems",
                template: "There are several problems associated with [topic]. The primary issue is [problem 1]. Another significant concern is [problem 2].",
                tips: "Identify 2-3 clear problems with explanations/examples",
                keyPhrases: [
                    "The primary issue is",
                    "Another significant problem is",
                    "This leads to",
                    "As a consequence"
                ]
            },
            body2: {
                label: "Body Paragraph 2 - Solutions",
                template: "To address these issues, several measures can be taken. Firstly, [solution 1]. Additionally, [solution 2].",
                tips: "Provide practical, specific solutions that match the problems",
                keyPhrases: [
                    "To address this",
                    "One effective solution would be",
                    "Furthermore",
                    "Governments/Individuals could"
                ]
            },
            conclusion: {
                label: "Conclusion",
                template: "In conclusion, while [topic] causes significant problems such as [brief problem summary], these can be tackled through [brief solution summary].",
                tips: "Summarize both problems and solutions"
            }
        }
    },
    twoPart: {
        name: "Two-Part Question",
        questionPattern: "Why is this happening? What can be done?",
        structure: {
            intro: {
                label: "Introduction",
                template: "[Paraphrase topic]. This essay will explore the reasons behind this trend and suggest possible measures to address it.",
                tips: "Acknowledge both parts of the question"
            },
            body1: {
                label: "Body Paragraph 1 - Answer Part 1",
                template: "There are several reasons why [phenomenon]. Firstly, [reason 1]. Secondly, [reason 2].",
                tips: "Fully answer the first question with examples"
            },
            body2: {
                label: "Body Paragraph 2 - Answer Part 2",
                template: "Regarding [second part of question], [answer]. [Further development].",
                tips: "Fully answer the second question. Give it equal weight."
            },
            conclusion: {
                label: "Conclusion",
                template: "In conclusion, [phenomenon] occurs due to [brief summary of part 1], and can be addressed through [brief summary of part 2].",
                tips: "Summarize both answers concisely"
            }
        }
    }
};

// Idea Bank - Common arguments and examples
export const ideaBank = {
    education: {
        arguments: {
            for: [
                "Develops critical thinking skills",
                "Increases employment opportunities",
                "Promotes social mobility",
                "Preserves cultural knowledge"
            ],
            against: [
                "May not suit all learning styles",
                "Can be disconnected from practical skills",
                "Rising costs create inequality",
                "Focus on grades rather than learning"
            ]
        },
        examples: [
            "Finland's education system emphasizes equality and practical skills",
            "South Korea's intense academic pressure causes high stress levels",
            "Online learning platforms like Coursera democratize access"
        ],
        vocabulary: [
            "tertiary education",
            "vocational training",
            "curriculum",
            "pedagogy",
            "literacy rate"
        ]
    },
    technology: {
        arguments: {
            for: [
                "Improves communication and connectivity",
                "Increases productivity and efficiency",
                "Provides access to information",
                "Enables innovative solutions"
            ],
            against: [
                "Causes social isolation",
                "Privacy and security concerns",
                "Job displacement through automation",
                "Digital divide creates inequality"
            ]
        },
        examples: [
            "Telemedicine connecting rural patients to specialists",
            "Social media's impact on mental health among teenagers",
            "AI replacing traditional manufacturing jobs"
        ],
        vocabulary: [
            "digital transformation",
            "automation",
            "cybersecurity",
            "artificial intelligence",
            "data privacy"
        ]
    },
    environment: {
        arguments: {
            for: [
                "Climate change threatens future generations",
                "Biodiversity loss disrupts ecosystems",
                "Renewable energy creates jobs",
                "Green spaces improve health"
            ],
            against: [
                "Environmental regulations may harm economy",
                "Individual actions have minimal impact",
                "Developing countries prioritize growth",
                "Technology will solve environmental problems"
            ]
        },
        examples: [
            "Costa Rica generating 99% electricity from renewables",
            "Great Pacific Garbage Patch demonstrating plastic pollution",
            "Electric vehicles reducing urban air pollution"
        ],
        vocabulary: [
            "sustainability",
            "carbon footprint",
            "renewable resources",
            "biodiversity",
            "ecosystem"
        ]
    },
    health: {
        arguments: {
            for: [
                "Prevention is better than cure",
                "Universal healthcare ensures equality",
                "Mental health awareness reduces stigma",
                "Active lifestyle prevents diseases"
            ],
            against: [
                "Healthcare costs burden taxpayers",
                "Personal choice vs government intervention",
                "Traditional medicine vs modern medicine debate"
            ]
        },
        examples: [
            "Singapore's preventive health screening programs",
            "Japan's high life expectancy linked to diet and lifestyle",
            "COVID-19 pandemic highlighting healthcare inequalities"
        ],
        vocabulary: [
            "preventive care",
            "epidemic",
            "medical infrastructure",
            "public health",
            "well-being"
        ]
    },
    globalisation: {
        arguments: {
            for: [
                "Promotes cultural exchange",
                "Increases trade and economic growth",
                "Shares technological innovations",
                "Improves international cooperation"
            ],
            against: [
                "Threatens local cultures and languages",
                "Exploits developing countries",
                "Increases inequality",
                "Homogenizes global culture"
            ]
        },
        examples: [
            "McDonald's adapting menu to local tastes worldwide",
            "English becoming global business language",
            "Fair trade movement protecting small producers"
        ],
        vocabulary: [
            "cross-cultural",
            "multinational corporations",
            "cultural homogenization",
            "international trade",
            "cultural diversity"
        ]
    }
};

// Linking phrases by purpose
export const linkingPhrases = {
    adding: [
        "Furthermore",
        "Moreover",
        "In addition",
        "Additionally",
        "Besides this"
    ],
    contrasting: [
        "However",
        "On the other hand",
        "In contrast",
        "Conversely",
        "Nevertheless"
    ],
    causeEffect: [
        "Consequently",
        "As a result",
        "Therefore",
        "Thus",
        "This leads to"
    ],
    example: [
        "For instance",
        "For example",
        "To illustrate",
        "Such as",
        "In particular"
    ],
    emphasizing: [
        "Indeed",
        "In fact",
        "Clearly",
        "Certainly",
        "Undoubtedly"
    ],
    concluding: [
        "In conclusion",
        "To summarize",
        "Overall",
        "In summary",
        "To conclude"
    ]
};
