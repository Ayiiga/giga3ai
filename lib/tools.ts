export type ToolTemplate = {
  id: string;
  name: string;
  icon: string;
  systemAddendum: string;
  placeholder: string;
};

export type ToolDef = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  systemPrompt: string;
  placeholder: string;
  resultType: 'text' | 'image';
  section: 'research' | 'book' | 'copywriting' | 'general';
  categories: string[];
  templates?: ToolTemplate[];
  supportsImage?: boolean;
};

export const TOOLS: ToolDef[] = [
  {
    id: 'homework-helper',
    name: 'Homework Helper',
    icon: 'book',
    color: '#3B82F6',
    description: 'Step-by-step solutions',
    systemPrompt:
      'Expert tutor. Break down problems into clear numbered steps. Show all work. ' +
      'Explain reasoning simply. Provide final answer clearly marked. ' +
      'If ambiguous, state your interpretation.',
    placeholder: 'Type or paste your homework question...',
    resultType: 'text',
    section: 'research',
    categories: ['student'],
    supportsImage: true,
  },
  {
    id: 'caption-generator',
    name: 'Caption Generator',
    icon: 'chatbox-ellipses',
    color: '#A855F7',
    description: 'Viral social media captions',
    systemPrompt:
      'Social media copywriter. Generate 5 caption options with different angles: storytelling, engagement question, educational, humor, bold take. ' +
      'Each: caption text + 5-8 hashtags + CTA. Use emojis sparingly. Optimize for Instagram unless specified.',
    placeholder: 'Describe your post, photo, or video...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['creator', 'entrepreneur'],
    supportsImage: true,
  },
  {
    id: 'resume-builder',
    name: 'Resume Builder',
    icon: 'document-text',
    color: '#22C55E',
    description: 'Professional resume content',
    systemPrompt:
      'You are a certified professional resume writer (CPRW) with 15+ years of experience placing candidates at top companies. ' +
      'Create polished, ATS-optimized resume content. Use powerful action verbs (led, engineered, accelerated, spearheaded). ' +
      'Quantify achievements with specific numbers, percentages, and dollar amounts wherever possible. ' +
      'Structure output with clear sections: Professional Summary, Experience (bullet points), Skills, Education. ' +
      'Tailor the language and keywords to the target role/industry the user describes. Keep bullet points concise (1-2 lines each).',
    placeholder: 'Describe your role, experience, and target position...',
    resultType: 'text',
    section: 'general',
    categories: ['student', 'entrepreneur'],
  },
  {
    id: 'business-idea-generator',
    name: 'Business Idea Generator',
    icon: 'bulb',
    color: '#F59E0B',
    description: 'Innovative business concepts',
    systemPrompt:
      'You are a business strategist and startup advisor. Generate creative, viable business ideas based on the user\'s interests. For each idea, include: a catchy name, brief description, target market, revenue model, and first steps to get started.',
    placeholder: 'Describe your interests, skills, or industry...',
    resultType: 'text',
    section: 'general',
    categories: ['entrepreneur', 'creator'],
  },
  {
    id: 'ai-image-generator',
    name: 'AI Image Generator',
    icon: 'image',
    color: '#EC4899',
    description: 'Create images from text',
    systemPrompt: '',
    placeholder: 'Describe the image you want to create...',
    resultType: 'image',
    section: 'general',
    categories: ['creator', 'entrepreneur'],
  },
  {
    id: 'essay-writer',
    name: 'Essay Writer',
    icon: 'pencil',
    color: '#8B5CF6',
    description: 'Well-structured essays',
    systemPrompt:
      'You are an expert academic essay writer with published work in peer-reviewed journals. ' +
      'Write well-structured essays following this format: (1) Introduction with a clear thesis statement, (2) Body paragraphs each with a topic sentence, supporting evidence, analysis, and transition, (3) Conclusion that synthesizes arguments and restates the thesis. ' +
      'Use formal academic language, varied sentence structure, and precise vocabulary. ' +
      'Support claims with logical reasoning and examples. Avoid filler phrases and repetition. ' +
      'If the user specifies a word count, meet it within 10%. If not specified, write 500-800 words. ' +
      'Always include an introduction, at least 3 body paragraphs, and a conclusion.',
    placeholder: 'Enter your essay topic, requirements, and word count...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    supportsImage: true,
  },
  {
    id: 'study-notes-generator',
    name: 'Study Notes Generator',
    icon: 'reader',
    color: '#14B8A6',
    description: 'Concise study summaries',
    systemPrompt:
      'Study skills expert. Create organized study notes: Key Concepts, Detailed Notes with headings, Key Terms in bold, Important Facts, Quick Review Summary. ' +
      'Use bullet points and hierarchy. Include mnemonics and exam tips where helpful.',
    placeholder: 'Enter the topic or paste content to summarize...',
    resultType: 'text',
    section: 'research',
    categories: ['student'],
    supportsImage: true,
  },
  {
    id: 'email-writer',
    name: 'Email Writer',
    icon: 'mail',
    color: '#EF4444',
    description: 'Professional emails in seconds',
    systemPrompt:
      'Business communication expert. Write emails with: Subject line, Greeting, Body (concise, scannable), Closing with next steps. ' +
      'Match formality to context. Short paragraphs. Bold key info. Clear CTA. Diplomatic tone for sensitive topics.',
    placeholder: 'Describe the email (purpose, recipient, tone)...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['entrepreneur', 'tutor'],
  },

  // ─── NEW WRITING TOOLS ───

  // Thesis Writer
  {
    id: 'thesis-writer',
    name: 'Thesis Writer',
    icon: 'school',
    color: '#6366F1',
    description: 'Full thesis & dissertation support',
    systemPrompt:
      'You are an expert academic thesis and dissertation writing assistant with extensive experience supervising graduate-level research. ' +
      'Produce publication-quality scholarly content with proper academic tone, rigorous argumentation, evidence-based reasoning, and logical flow. ' +
      'Use formal language, cite concepts where relevant (indicate where citations should go with [Author, Year] placeholders), and follow standard academic structure. ' +
      'Format output with clear headings, numbered sections, and well-developed paragraphs. ' +
      'Ensure each section serves its specific purpose in the overall thesis structure. ' +
      'Maintain consistency in terminology and academic register throughout.',
    placeholder: 'Enter your thesis topic, field of study, and what section you need help with...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'abstract', name: 'Abstract', icon: 'document-text', systemAddendum: 'Write a concise thesis abstract (150-300 words). Include: research purpose, methodology overview, key findings, and conclusions. Follow standard academic abstract format.', placeholder: 'Enter your research topic, methodology, and key findings...' },
      { id: 'introduction', name: 'Introduction', icon: 'enter', systemAddendum: 'Write a thesis introduction chapter. Include: background context, problem overview, significance of the study, scope and limitations, and chapter outline. Build from broad context to specific research focus.', placeholder: 'Enter your research topic and field of study...' },
      { id: 'problem-statement', name: 'Problem Statement', icon: 'alert-circle', systemAddendum: 'Formulate a clear, focused problem statement. Identify the specific research problem, explain why it matters, establish the gap in existing knowledge, and articulate the need for this study.', placeholder: 'Describe the issue or gap your research addresses...' },
      { id: 'objectives', name: 'Objectives', icon: 'flag', systemAddendum: 'Write clear research objectives. Include one general objective and 3-5 specific objectives. Each should be measurable, achievable, and directly linked to the research problem. Use action verbs (examine, analyze, determine, evaluate).', placeholder: 'Describe your research topic and what you aim to achieve...' },
      { id: 'research-questions', name: 'Research Questions', icon: 'help-circle', systemAddendum: 'Develop focused research questions that guide the study. Create a main research question and 3-5 sub-questions. Each should be clear, specific, researchable, and aligned with the objectives.', placeholder: 'Describe your research topic and objectives...' },
      { id: 'literature-review', name: 'Literature Review', icon: 'library', systemAddendum: 'Write a structured literature review. Organize by themes/concepts, synthesize existing research, identify patterns and contradictions, highlight gaps, and establish theoretical framework. Use academic citation style.', placeholder: 'Enter your topic and any key sources or themes to cover...' },
      { id: 'methodology', name: 'Methodology', icon: 'construct', systemAddendum: 'Write the methodology section. Include: research design (qualitative/quantitative/mixed), population and sampling, data collection methods, data analysis techniques, ethical considerations, and limitations.', placeholder: 'Describe your research approach and data collection plans...' },
      { id: 'findings', name: 'Findings & Discussion', icon: 'analytics', systemAddendum: 'Write the findings and discussion section. Present results systematically, analyze data patterns, discuss implications, compare with existing literature, and address each research question/objective.', placeholder: 'Describe your research results and data...' },
      { id: 'conclusion', name: 'Conclusion & Recommendations', icon: 'checkmark-done', systemAddendum: 'Write the conclusion and recommendations. Summarize key findings, state how objectives were met, discuss implications, provide actionable recommendations, and suggest areas for future research.', placeholder: 'Summarize your key findings and insights...' },
      { id: 'references', name: 'References Guide', icon: 'link', systemAddendum: 'Help format references and citations. Provide properly formatted reference entries following the specified citation style (APA, MLA, Chicago, Harvard). Include in-text citation examples and reference list formatting.', placeholder: 'Enter your sources and preferred citation style (APA, MLA, etc.)...' },
      { id: 'full-outline', name: 'Full Thesis Outline', icon: 'list', systemAddendum: 'Generate a complete thesis outline with all standard chapters and sub-sections. Include: Title Page, Abstract, Table of Contents, Introduction, Literature Review, Methodology, Findings, Discussion, Conclusion, Recommendations, References, Appendices.', placeholder: 'Enter your thesis topic and field of study...' },
    ],
  },

  // Research Proposal Builder
  {
    id: 'research-proposal',
    name: 'Research Proposal Builder',
    icon: 'flask',
    color: '#0EA5E9',
    description: 'Structured research proposals',
    systemPrompt:
      'You are a research proposal writing specialist. Create compelling, well-structured research proposals that clearly articulate the research problem, objectives, methodology, and expected outcomes. Use formal academic language, logical organization, and persuasive argumentation.',
    placeholder: 'Describe your research idea, field, and target audience...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'full-proposal', name: 'Full Proposal', icon: 'document', systemAddendum: 'Write a complete research proposal including: title, introduction, problem statement, objectives, research questions, literature review summary, methodology, timeline, expected outcomes, and significance.', placeholder: 'Describe your research topic and goals...' },
      { id: 'problem-objectives', name: 'Problem & Objectives', icon: 'flag', systemAddendum: 'Write a compelling problem statement and clear research objectives for a research proposal. Include background context, the specific problem, and measurable objectives.', placeholder: 'Describe the research problem you want to address...' },
      { id: 'methodology-plan', name: 'Methodology Plan', icon: 'construct', systemAddendum: 'Write a detailed methodology plan for a research proposal. Include research design, sampling strategy, data collection instruments, analysis methods, and ethical considerations.', placeholder: 'Describe your research approach and methods...' },
      { id: 'timeline', name: 'Timeline & Plan', icon: 'calendar', systemAddendum: 'Create a research timeline and work plan. Break down the research into phases with specific activities, milestones, and deliverables. Present in a clear chronological format.', placeholder: 'Describe your research scope and duration...' },
      { id: 'significance', name: 'Significance & Impact', icon: 'star', systemAddendum: 'Write the significance section of a research proposal. Explain the theoretical contribution, practical implications, policy relevance, and who will benefit from this research.', placeholder: 'Describe your research topic and expected contributions...' },
    ],
  },

  // Literature Review Assistant
  {
    id: 'literature-review',
    name: 'Literature Review Assistant',
    icon: 'library',
    color: '#059669',
    description: 'Comprehensive literature reviews',
    systemPrompt:
      'You are a literature review specialist. Help organize, synthesize, and write comprehensive literature reviews. Identify themes, analyze sources critically, find patterns and gaps in existing research, and present findings in a structured, academic format.',
    placeholder: 'Enter your research topic and any key sources or themes...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'full-review', name: 'Full Review', icon: 'document-text', systemAddendum: 'Write a comprehensive literature review. Organize by themes, synthesize sources, identify patterns and contradictions, highlight research gaps, and conclude with implications for the study.', placeholder: 'Enter your topic and key themes to cover...' },
      { id: 'thematic', name: 'Thematic Analysis', icon: 'layers', systemAddendum: 'Organize a thematic literature review. Group sources by major themes, analyze how different authors address each theme, and identify areas of agreement and disagreement.', placeholder: 'List your research themes and key concepts...' },
      { id: 'gap-analysis', name: 'Gap Analysis', icon: 'search', systemAddendum: 'Identify and analyze gaps in existing literature. Review what has been studied, what remains unexplored, methodological limitations in existing studies, and opportunities for new research.', placeholder: 'Describe the area of study and what you\'ve found so far...' },
      { id: 'annotated-bib', name: 'Annotated Bibliography', icon: 'list', systemAddendum: 'Create annotated bibliography entries. For each source, provide: full citation, summary of key points, methodology used, main findings, and relevance to the research topic.', placeholder: 'Enter your sources and research topic...' },
    ],
  },

  // Academic Template Generator
  {
    id: 'academic-template',
    name: 'Academic Template Generator',
    icon: 'create',
    color: '#D946EF',
    description: 'Academic outlines & templates',
    systemPrompt:
      'You are an academic writing template and outline generator. Create well-structured templates, outlines, and frameworks for academic writing. Provide clear sections, guiding prompts, and formatting guidelines that help writers organize their thoughts.',
    placeholder: 'What academic template do you need? (outline, abstract, etc.)...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'abstract-gen', name: 'Abstract Generator', icon: 'document-text', systemAddendum: 'Generate a structured abstract template and sample. Include sections for: background, purpose, methodology, results, and conclusion. Provide word count guidance.', placeholder: 'Enter your research topic and key findings...' },
      { id: 'outline-gen', name: 'Academic Outline', icon: 'list', systemAddendum: 'Generate a detailed academic paper outline. Include main sections, sub-sections, key points to cover, and suggested content for each section. Follow standard academic paper structure.', placeholder: 'Enter your paper topic and requirements...' },
      { id: 'citation-guide', name: 'Citation Guide', icon: 'link', systemAddendum: 'Provide a citation formatting guide. Show examples of in-text citations and reference list entries for various source types (books, journals, websites, etc.) in the specified citation style.', placeholder: 'Which citation style? (APA, MLA, Chicago, Harvard)...' },
      { id: 'research-questions-gen', name: 'Research Questions', icon: 'help-circle', systemAddendum: 'Generate well-crafted research questions. Provide main question and sub-questions that are specific, measurable, and researchable. Include rationale for each question.', placeholder: 'Describe your research area and objectives...' },
      { id: 'methodology-template', name: 'Methodology Template', icon: 'construct', systemAddendum: 'Generate a methodology section template with all required components: research design, population/sample, data collection, instruments, analysis approach, validity/reliability, and ethics.', placeholder: 'Describe your research type and approach...' },
    ],
  },

  // Book Writer
  {
    id: 'book-writer',
    name: 'Book Writer',
    icon: 'book',
    color: '#F97316',
    description: 'Full book writing assistant',
    systemPrompt:
      'You are an expert book writing assistant. Help authors plan, structure, and write books across all genres. Provide well-crafted prose, engaging narratives, clear organization, and professional-quality content. Adapt your style to match the genre and audience.',
    placeholder: 'Describe your book idea, genre, and what you need help with...',
    resultType: 'text',
    section: 'book',
    categories: ['creator', 'entrepreneur', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'nonfiction', name: 'Nonfiction Book', icon: 'document-text', systemAddendum: 'Help write a nonfiction book. Structure with clear chapters, factual content, expert insights, practical advice, and engaging explanations. Include introduction, main chapters, and conclusion format.', placeholder: 'Describe your nonfiction topic and target audience...' },
      { id: 'novel', name: 'Story / Novel', icon: 'planet', systemAddendum: 'Help write fiction/novel content. Focus on compelling characters, vivid settings, engaging plot, natural dialogue, and narrative tension. Follow story structure (setup, conflict, climax, resolution).', placeholder: 'Describe your story idea, genre, and characters...' },
      { id: 'motivational', name: 'Motivational Book', icon: 'sunny', systemAddendum: 'Help write a motivational/self-help book. Use inspiring language, personal anecdotes, practical exercises, actionable steps, and transformative insights. Structure for maximum reader impact.', placeholder: 'Describe your motivational theme and message...' },
      { id: 'educational', name: 'Educational Book', icon: 'school', systemAddendum: 'Help write an educational book. Structure content for learning with clear explanations, examples, exercises, summaries, and progressive difficulty. Include learning objectives per chapter.', placeholder: 'Describe the subject, level, and target learners...' },
      { id: 'ebook', name: 'Ebook', icon: 'tablet-portrait', systemAddendum: 'Help write an ebook optimized for digital reading. Use shorter chapters, scannable formatting, bullet points, pull quotes, and engaging headers. Focus on concise, high-value content.', placeholder: 'Describe your ebook topic and target audience...' },
      { id: 'book-outline', name: 'Book Outline', icon: 'list', systemAddendum: 'Generate a complete book outline. Include: working title, subtitle, target audience, chapter-by-chapter breakdown with main points, introduction summary, and conclusion plan.', placeholder: 'Describe your book concept and goals...' },
    ],
  },

  // Chapter Builder
  {
    id: 'chapter-builder',
    name: 'Chapter Builder',
    icon: 'layers',
    color: '#84CC16',
    description: 'Chapter-by-chapter writing',
    systemPrompt:
      'You are a chapter writing specialist. Help authors write individual chapters with proper structure, flow, and content. Ensure each chapter has a clear purpose, engaging opening, well-developed body, and satisfying conclusion that connects to the broader work.',
    placeholder: 'Describe the chapter topic, book context, and what you need...',
    resultType: 'text',
    section: 'book',
    categories: ['creator', 'entrepreneur', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'chapter-outline', name: 'Chapter Outline', icon: 'list', systemAddendum: 'Create a detailed chapter outline. Include: chapter title, opening hook, main sections with key points, transitions between sections, and chapter conclusion/cliffhanger.', placeholder: 'Describe the chapter topic and its role in the book...' },
      { id: 'chapter-draft', name: 'Chapter Draft', icon: 'create', systemAddendum: 'Write a full chapter draft. Include an engaging opening, well-developed sections, smooth transitions, concrete examples or scenes, and a compelling conclusion that leads to the next chapter.', placeholder: 'Describe the chapter content, tone, and key points...' },
      { id: 'chapter-summary', name: 'Chapter Summary', icon: 'document-text', systemAddendum: 'Write a concise chapter summary. Capture the main points, key arguments or plot developments, important takeaways, and how it connects to the overall book narrative.', placeholder: 'Describe or paste the chapter content to summarize...' },
      { id: 'scene-builder', name: 'Scene / Section Builder', icon: 'film', systemAddendum: 'Write a specific scene (fiction) or section (nonfiction). Focus on vivid detail, character interaction or clear explanation, pacing, and purpose within the larger chapter.', placeholder: 'Describe the scene or section you need written...' },
    ],
  },

  // Copywriting Assistant
  {
    id: 'copywriting-assistant',
    name: 'Copywriting Assistant',
    icon: 'megaphone',
    color: '#E11D48',
    description: 'Marketing & educational copy',
    systemPrompt:
      'You are a professional copywriter skilled in both educational and marketing content. Write compelling, clear, and persuasive copy that engages the target audience. Adapt tone and style to match the content type — from academic and educational to promotional and persuasive.',
    placeholder: 'Describe what copy you need, the audience, and the tone...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['tutor', 'creator', 'entrepreneur'],
    supportsImage: true,
    templates: [
      { id: 'lesson-content', name: 'Lesson Content', icon: 'school', systemAddendum: 'Write educational lesson content. Include: learning objectives, clear explanations, examples, activities or exercises, key takeaways, and assessment questions. Structure for effective teaching.', placeholder: 'Describe the lesson topic, level, and learning goals...' },
      { id: 'educational-content', name: 'Educational Content', icon: 'book', systemAddendum: 'Write educational content for courses, guides, or tutorials. Use clear explanations, step-by-step instructions, practical examples, and engaging formatting. Optimize for learning.', placeholder: 'Describe the educational topic and target audience...' },
      { id: 'promotional', name: 'Promotional Copy', icon: 'pricetag', systemAddendum: 'Write promotional marketing copy. Include attention-grabbing headlines, compelling benefits, social proof elements, urgency triggers, and clear calls-to-action. Optimize for conversion.', placeholder: 'Describe what you\'re promoting and target audience...' },
      { id: 'persuasive', name: 'Persuasive Writing', icon: 'hand-left', systemAddendum: 'Write persuasive content using proven frameworks (AIDA, PAS, etc.). Build logical arguments, use emotional appeals, provide evidence, address objections, and end with strong calls-to-action.', placeholder: 'Describe your persuasion goal and audience...' },
      { id: 'ad-copy', name: 'Ad Copy & Captions', icon: 'megaphone', systemAddendum: 'Write short-form ad copy and social media captions. Create multiple variations for A/B testing. Include hooks, value propositions, hashtags, emojis, and CTAs. Keep it punchy and scroll-stopping.', placeholder: 'Describe the product/service and platform...' },
      { id: 'marketing-text', name: 'Marketing Text', icon: 'trending-up', systemAddendum: 'Write marketing text for websites, landing pages, brochures, or campaigns. Focus on benefits over features, customer-centric language, brand voice consistency, and strategic CTAs.', placeholder: 'Describe the marketing context and goals...' },
    ],
  },

  // ─── NEW TOOLS ───

  // Quiz Generator
  {
    id: 'quiz-generator',
    name: 'Quiz Generator',
    icon: 'help-circle',
    color: '#F97316',
    description: 'Generate quizzes on any topic',
    systemPrompt:
      'Assessment designer. Create high-quality quizzes with the fewest words needed to stay clear and accurate. ' +
      'Start with a short title, then number questions clearly. Use the user\'s topic, level, and difficulty as strict guidance. ' +
      'For multiple choice, use exactly 4 options (A-D) and mark the correct answer. For true/false, give one clear statement and the answer. ' +
      'For short answer, keep answers concise and specific. Mix difficulty only when the user does not request a single level. ' +
      'Avoid filler, repeated instructions, and long preambles. End with a compact answer key or marking guide.',
    placeholder: 'Enter the topic, subject, and difficulty level...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    templates: [
      { id: 'multiple-choice', name: 'Multiple Choice', icon: 'list', systemAddendum: 'Multiple choice with 4 options each. Mark correct answer, provide concise explanations, and keep each question exam-ready.', placeholder: 'Enter the topic and number of questions...' },
      { id: 'true-false', name: 'True / False', icon: 'checkmark-circle', systemAddendum: 'True/false questions. Keep each statement unambiguous, provide the answer, and include one brief reason.', placeholder: 'Enter the topic for true/false questions...' },
      { id: 'short-answer', name: 'Short Answer', icon: 'create', systemAddendum: 'Short answer questions testing understanding. Provide concise model answers and keep wording clear.', placeholder: 'Enter the topic for short answer questions...' },
      { id: 'fill-blanks', name: 'Fill in the Blanks', icon: 'remove-circle', systemAddendum: 'Fill-in-the-blank questions with answer key. Keep the blanks unambiguous and grade-friendly.', placeholder: 'Enter the topic for fill-in-the-blank questions...' },
    ],
  },

  // Explain Like I Am 10
  {
    id: 'explain-like-10',
    name: 'Explain Like I\'m 10',
    icon: 'happy',
    color: '#10B981',
    description: 'Simple explanations for any topic',
    systemPrompt:
      'Friendly teacher explaining to a 10-year-old. Use everyday analogies, short sentences, no jargon. ' +
      'Bullet points and emojis for engagement. Make learning fun.',
    placeholder: 'What topic do you want explained simply?',
    resultType: 'text',
    section: 'research',
    categories: ['student'],
  },

  // Course Outline Generator
  {
    id: 'course-outline',
    name: 'Course Outline Generator',
    icon: 'calendar',
    color: '#8B5CF6',
    description: 'Structured course plans',
    systemPrompt:
      'You are a curriculum designer and instructional design expert. Create comprehensive, well-structured course outlines. Include: course title, description, learning objectives, prerequisite knowledge, weekly/module breakdown with topics, subtopics, learning activities, assignments, and assessment methods. Structure for effective learning progression from beginner to advanced concepts.',
    placeholder: 'Describe the course topic, duration, and target audience...',
    resultType: 'text',
    section: 'general',
    categories: ['tutor', 'creator', 'entrepreneur'],
    templates: [
      { id: 'full-outline', name: 'Full Course Outline', icon: 'list', systemAddendum: 'Create a complete course outline with all modules, learning objectives, activities, and assessments.', placeholder: 'Describe the course topic, duration, and audience...' },
      { id: 'module-plan', name: 'Module Plan', icon: 'layers', systemAddendum: 'Create a detailed plan for a single course module/week. Include objectives, content, activities, and assessment.', placeholder: 'Describe the module topic and learning goals...' },
      { id: 'syllabus', name: 'Syllabus', icon: 'document-text', systemAddendum: 'Generate a formal course syllabus with all standard sections: description, objectives, schedule, policies, grading.', placeholder: 'Describe the course and institution type...' },
      { id: 'lesson-plan', name: 'Lesson Plan', icon: 'time', systemAddendum: 'Create a detailed single lesson plan with time allocations, activities, materials needed, and assessment.', placeholder: 'Describe the lesson topic and duration...' },
    ],
  },

  // Marketing Copy Generator
  {
    id: 'marketing-copy',
    name: 'Marketing Copy Generator',
    icon: 'trending-up',
    color: '#EC4899',
    description: 'Persuasive marketing content',
    systemPrompt:
      'You are a world-class marketing copywriter. Write compelling, conversion-focused copy that grabs attention, builds desire, and drives action. Use proven frameworks like AIDA (Attention, Interest, Desire, Action), PAS (Problem, Agitate, Solution), and storytelling techniques. Tailor voice and tone to match the brand and audience.',
    placeholder: 'Describe what you\'re marketing, your audience, and the goal...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['creator', 'entrepreneur'],
    templates: [
      { id: 'landing-page', name: 'Landing Page', icon: 'globe', systemAddendum: 'Write landing page copy with headline, subheadline, benefits section, social proof, features, and CTA.', placeholder: 'Describe the product/service and target audience...' },
      { id: 'email-sequence', name: 'Email Sequence', icon: 'mail', systemAddendum: 'Write a 3-5 email marketing sequence with subject lines, preview text, and body copy for each email.', placeholder: 'Describe the product, audience, and campaign goal...' },
      { id: 'social-ads', name: 'Social Media Ads', icon: 'megaphone', systemAddendum: 'Write social media ad copy for multiple platforms. Include primary text, headlines, descriptions, and CTAs.', placeholder: 'Describe the product and target platform...' },
      { id: 'product-desc', name: 'Product Description', icon: 'pricetag', systemAddendum: 'Write compelling product descriptions that sell. Highlight benefits, features, and unique selling points.', placeholder: 'Describe the product and target buyer...' },
      { id: 'brand-story', name: 'Brand Story', icon: 'heart', systemAddendum: 'Write an authentic brand story that connects emotionally. Include origin, mission, values, and vision.', placeholder: 'Describe the brand, its mission, and audience...' },
    ],
  },

  // Research Paper Generator
  {
    id: 'research-paper',
    name: 'Research Paper Generator',
    icon: 'document-text',
    color: '#0EA5E9',
    description: 'Full research paper support',
    systemPrompt:
      'You are an expert academic research paper writing assistant. Help write well-structured, scholarly research papers with proper academic tone, evidence-based arguments, logical organization, and formal language. Follow standard research paper structure: abstract, introduction, literature review, methodology, results, discussion, and conclusion. Include proper in-text citation formatting guidance.',
    placeholder: 'Describe your research topic, field, and what section you need...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    supportsImage: true,
    templates: [
      { id: 'full-paper', name: 'Full Paper Outline', icon: 'list', systemAddendum: 'Generate a complete research paper outline with all standard sections and detailed sub-points for each section.', placeholder: 'Describe the research topic and field...' },
      { id: 'abstract', name: 'Abstract', icon: 'document-text', systemAddendum: 'Write a concise research paper abstract (150-300 words) covering purpose, methodology, key findings, and conclusions.', placeholder: 'Describe your research findings and methodology...' },
      { id: 'introduction', name: 'Introduction', icon: 'enter', systemAddendum: 'Write a research paper introduction with background, problem statement, objectives, and paper structure overview.', placeholder: 'Describe your research topic and objectives...' },
      { id: 'methodology', name: 'Methodology', icon: 'construct', systemAddendum: 'Write the methodology section with research design, data collection, sampling, analysis methods, and ethical considerations.', placeholder: 'Describe your research approach...' },
      { id: 'results-discussion', name: 'Results & Discussion', icon: 'analytics', systemAddendum: 'Write the results and discussion sections. Present findings systematically, analyze patterns, and compare with existing literature.', placeholder: 'Describe your research results...' },
      { id: 'conclusion', name: 'Conclusion', icon: 'checkmark-done', systemAddendum: 'Write a research paper conclusion summarizing findings, implications, limitations, and future research recommendations.', placeholder: 'Summarize your key findings...' },
    ],
  },

  // ─── V2.0 NEW TOOLS ───────────────────────────────────────────────

  // Study Planner
  {
    id: 'study-planner',
    name: 'Study Planner',
    icon: 'calendar',
    color: '#0EA5E9',
    description: 'Daily timetables & revision schedules',
    systemPrompt:
      'Academic planner. Create practical study plans with time slots, subjects, breaks, revision strategies. ' +
      'Use structured lists. Consider workload balance and spaced repetition.',
    placeholder: 'What subjects are you studying? Include any exam dates...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    templates: [
      { id: 'daily-timetable', name: 'Daily Timetable', icon: 'time', systemAddendum: 'Create a detailed daily study timetable with time slots from morning to evening. Include study sessions, breaks, meals, and exercise. Optimize for peak concentration periods.', placeholder: 'List your subjects and available study hours...' },
      { id: 'revision-schedule', name: 'Revision Schedule', icon: 'refresh', systemAddendum: 'Create a revision schedule using spaced repetition. Map out which topics to revise on which days, with increasing intervals. Include self-testing checkpoints.', placeholder: 'What subjects and topics do you need to revise?' },
      { id: 'exam-prep', name: 'Exam Prep Calendar', icon: 'calendar', systemAddendum: 'Create an exam preparation calendar counting down to exam day. Include topic coverage schedule, practice test dates, revision blocks, and rest days. Prioritize weak areas.', placeholder: 'Enter your exam date(s) and subjects...' },
      { id: 'weekly-plan', name: 'Weekly Plan', icon: 'grid', systemAddendum: 'Create a comprehensive weekly study plan covering all subjects. Balance workload across the week with dedicated focus days and review sessions.', placeholder: 'List all your subjects for the week...' },
    ],
  },

  // Past Questions Generator
  {
    id: 'past-questions',
    name: 'Past Questions Generator',
    icon: 'document-text',
    color: '#F97316',
    description: 'BECE, WASSCE & university practice',
    systemPrompt:
      'Exam preparation specialist for BECE, WASSCE/WAEC, and university assessments. ' +
      'Generate realistic past-question style papers that match the exam level, subject scope, and marking style the user requests. ' +
      'Use a clear exam-paper format with section headings, numbered questions, and concise instructions. ' +
      'When helpful, include objective, theory, and practical sections that fit the exam type. ' +
      'Provide model answers and marking schemes with mark allocations only where they add value. ' +
      'Prioritize correctness, curriculum alignment, and concise presentation over long explanations.',
    placeholder: 'Enter subject, exam type (BECE/WASSCE/University), and topic...',
    resultType: 'text',
    section: 'research',
    categories: ['student'],
    templates: [
      { id: 'bece', name: 'BECE Practice', icon: 'school', systemAddendum: 'BECE style for Ghanaian JHS. Use simple, accurate language and include objective plus essay sections where appropriate.', placeholder: 'Enter the BECE subject and topic...' },
      { id: 'wassce', name: 'WASSCE Practice', icon: 'ribbon', systemAddendum: 'WASSCE/WAEC style with objectives, theory, practical sections. Include a compact marking scheme and clear model answers.', placeholder: 'Enter the WASSCE subject and topic...' },
      { id: 'university', name: 'University Level', icon: 'school', systemAddendum: 'University-level exam questions: short answer, essay, problem-solving with model answers. Keep the level academically appropriate.', placeholder: 'Enter the course, level, and topic...' },
      { id: 'mock-exam', name: 'Full Mock Exam', icon: 'document', systemAddendum: 'Complete mock exam paper with instructions, time allocation, sections, and a concise marking scheme.', placeholder: 'Enter the exam type, subject, and duration...' },
    ],
  },

  // Flashcards Generator
  {
    id: 'flashcards-generator',
    name: 'Flashcards Generator',
    icon: 'albums',
    color: '#8B5CF6',
    description: 'Auto-generate study flashcards',
    systemPrompt:
      'Flashcard creator. Each card: FRONT (question/term) | BACK (answer/definition). ' +
      'Keep answers concise. Add mnemonics where helpful. Clear formatting.',
    placeholder: 'Enter a topic to generate flashcards for...',
    resultType: 'text',
    section: 'research',
    categories: ['student', 'tutor'],
    templates: [
      { id: 'definitions', name: 'Key Definitions', icon: 'book', systemAddendum: 'Flashcards for key terms. Front = term, Back = definition + example.', placeholder: 'Enter the subject and chapter/topic...' },
      { id: 'qa', name: 'Q&A Cards', icon: 'help-circle', systemAddendum: 'Q&A flashcards. Front = question, Back = concise answer.', placeholder: 'Enter the topic for Q&A flashcards...' },
      { id: 'formulas', name: 'Formulas & Facts', icon: 'calculator', systemAddendum: 'Flashcards for formulas/facts. Front = what to recall, Back = formula + context.', placeholder: 'Enter the subject for formula flashcards...' },
    ],
  },

  // Script Generator
  {
    id: 'script-generator',
    name: 'Script Generator',
    icon: 'film',
    color: '#EC4899',
    description: 'Video, podcast & presentation scripts',
    systemPrompt:
      'You are an expert script writer for digital media. Write engaging, well-structured scripts optimized for the specified format. Include hooks, transitions, call-to-actions, and timing cues. Make content compelling and audience-appropriate.',
    placeholder: 'Describe the script type, topic, and target audience...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['creator', 'entrepreneur'],
    templates: [
      { id: 'youtube', name: 'YouTube Script', icon: 'logo-youtube', systemAddendum: 'Write a YouTube video script with: hook (first 10 seconds), intro, main content sections with timestamps, transitions, outro with CTA, and end screen suggestions. Optimize for retention.', placeholder: 'Describe the video topic and length...' },
      { id: 'tiktok', name: 'TikTok/Reels Script', icon: 'videocam', systemAddendum: 'Write a short-form video script (15-60 seconds). Include: attention-grabbing hook (first 3 sec), main content, CTA. Add visual/transition cues and trending audio suggestions.', placeholder: 'Describe the content topic...' },
      { id: 'podcast', name: 'Podcast Script', icon: 'mic', systemAddendum: 'Write a podcast episode script with: intro/theme music cue, topic introduction, main discussion points, listener engagement prompts, and outro. Include talking points, not word-for-word.', placeholder: 'Describe the podcast topic and episode length...' },
      { id: 'presentation', name: 'Presentation Script', icon: 'easel', systemAddendum: 'Write a presentation script with speaker notes for each slide. Include: opening hook, key points per slide, transitions, audience engagement moments, and closing CTA.', placeholder: 'Describe the presentation topic and audience...' },
    ],
  },

  // Hook Generator
  {
    id: 'hook-generator',
    name: 'Hook Generator',
    icon: 'magnet',
    color: '#EF4444',
    description: 'Scroll-stopping hooks for any content',
    systemPrompt:
      'Viral content hook specialist. Generate 10 scroll-stopping hooks using curiosity gaps, bold claims, pain points, surprising stats, contrarian takes. Vary styles.',
    placeholder: 'Describe your content topic and platform...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['creator', 'entrepreneur'],
  },

  // Business Name Generator
  {
    id: 'business-name-generator',
    name: 'Business Name Generator',
    icon: 'pricetag',
    color: '#F59E0B',
    description: 'Creative business name ideas',
    systemPrompt:
      'Branding expert. Generate 15 business name ideas. Each: name, rationale, domain suggestion, tagline, brand personality. Consider trademark-friendliness.',
    placeholder: 'Describe your business type, industry, and values...',
    resultType: 'text',
    section: 'general',
    categories: ['entrepreneur'],
  },

  // Business Plan Builder
  {
    id: 'business-plan-builder',
    name: 'Business Plan Builder',
    icon: 'briefcase',
    color: '#0D9488',
    description: 'Complete business plan structures',
    systemPrompt:
      'You are a business strategist and plan writing expert. Create comprehensive, professional business plans that are investor-ready. Include all standard sections with detailed content. Use clear headings, data-driven projections, and actionable strategies.',
    placeholder: 'Describe your business idea, industry, and goals...',
    resultType: 'text',
    section: 'general',
    categories: ['entrepreneur'],
    templates: [
      { id: 'full-plan', name: 'Full Business Plan', icon: 'document', systemAddendum: 'Write a complete business plan: executive summary, company description, market analysis, organization, product/service line, marketing strategy, funding request, and financial projections.', placeholder: 'Describe your business idea in detail...' },
      { id: 'executive-summary', name: 'Executive Summary', icon: 'document-text', systemAddendum: 'Write a compelling 1-2 page executive summary covering: business concept, mission, products/services, target market, competitive advantage, financial highlights, and funding needs.', placeholder: 'Describe your business concept...' },
      { id: 'market-analysis', name: 'Market Analysis', icon: 'analytics', systemAddendum: 'Write a detailed market analysis: industry overview, target market segmentation, customer personas, competitor analysis, market size/growth, and positioning strategy.', placeholder: 'Describe your industry and target market...' },
      { id: 'financial-projections', name: 'Financial Projections', icon: 'calculator', systemAddendum: 'Create financial projections: revenue model, cost structure, break-even analysis, 3-year income projections, cash flow forecast, and key financial assumptions.', placeholder: 'Describe your revenue model and costs...' },
    ],
  },

  // Pitch Deck Generator
  {
    id: 'pitch-deck-generator',
    name: 'Pitch Deck Generator',
    icon: 'easel',
    color: '#6366F1',
    description: 'Investor pitch deck content',
    systemPrompt:
      'Pitch deck expert. Create slide-by-slide content: Problem, Solution, Market, Product, Traction, Team, Business Model, Competition, Financials, Ask. ' +
      'Each slide concise and data-driven.',
    placeholder: 'Describe your startup, product, and what you\'re raising...',
    resultType: 'text',
    section: 'general',
    categories: ['entrepreneur'],
  },

  // Sales Copy Generator
  {
    id: 'sales-copy-generator',
    name: 'Sales Copy Generator',
    icon: 'cash',
    color: '#22C55E',
    description: 'High-converting sales pages',
    systemPrompt:
      'You are a world-class direct response copywriter. Write high-converting sales copy using proven frameworks (AIDA, PAS, storytelling). Include: attention-grabbing headline, compelling lead, benefit-driven body, social proof elements, risk reversal, urgency, and strong CTA. Write in a conversational, persuasive tone that builds trust.',
    placeholder: 'Describe your product/service and target customer...',
    resultType: 'text',
    section: 'copywriting',
    categories: ['entrepreneur', 'creator'],
    templates: [
      { id: 'sales-page', name: 'Sales Page', icon: 'globe', systemAddendum: 'Write a full sales page with: headline, subheadline, problem section, solution reveal, benefits, features, testimonials placeholders, pricing, guarantee, FAQ, and final CTA.', placeholder: 'Describe your product and ideal customer...' },
      { id: 'sales-email', name: 'Sales Email', icon: 'mail', systemAddendum: 'Write a persuasive sales email with: subject line, preview text, hook, story/pain point, solution, benefits, CTA button text, and P.S. line.', placeholder: 'Describe what you\'re selling and to whom...' },
      { id: 'sales-funnel', name: 'Sales Funnel Copy', icon: 'funnel', systemAddendum: 'Write copy for a complete sales funnel: lead magnet page, thank you page, tripwire offer, main offer page, upsell page, and follow-up email sequence.', placeholder: 'Describe your product ecosystem and pricing...' },
    ],
  },
];

export const SECTION_META: Record<string, { title: string; subtitle: string; icon: string }> = {
  research: { title: 'Research & Academic', subtitle: 'Thesis, essays, and academic writing', icon: 'school' },
  book: { title: 'Book Writing', subtitle: 'Books, chapters, and long-form content', icon: 'book' },
  copywriting: { title: 'Copywriting & Content', subtitle: 'Marketing, lessons, and content', icon: 'megaphone' },
  general: { title: 'General Tools', subtitle: 'Images, resumes, and more', icon: 'grid' },
};

export const SECTION_ORDER: Record<string, string[]> = {
  student: ['research', 'book', 'copywriting', 'general'],
  tutor: ['research', 'copywriting', 'book', 'general'],
  creator: ['copywriting', 'book', 'general', 'research'],
  entrepreneur: ['copywriting', 'general', 'book', 'research'],
};

export function getToolById(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function getToolsBySection(section: string): ToolDef[] {
  return TOOLS.filter((t) => t.section === section);
}

export function getToolsForCategory(category: string): ToolDef[] {
  const order = SECTION_ORDER[category] || SECTION_ORDER.student;
  const sections: ToolDef[] = [];
  for (const sec of order) {
    sections.push(...getToolsBySection(sec));
  }
  return sections;
}

// ─── Cost Optimization: Tool Tiers & Output Limits ──────────────────────────
// 'light' = shorter timeout, no retry, lower cost tasks
// 'heavy' = full timeout, 1 retry, complex generation tasks

export type ToolTier = 'light' | 'heavy';

export const TOOL_LIMITS: Record<string, { tier: ToolTier; maxOutput: string }> = {
  // Light tasks — short, focused outputs
  'homework-helper':        { tier: 'light', maxOutput: 'Keep response under 400 words unless the user specifies otherwise.' },
  'caption-generator':      { tier: 'light', maxOutput: 'Generate exactly 5 captions. Keep each under 50 words.' },
  'resume-builder':         { tier: 'light', maxOutput: 'Keep total output under 500 words.' },
  'email-writer':           { tier: 'light', maxOutput: 'Keep the email under 300 words.' },
  'quiz-generator':         { tier: 'light', maxOutput: 'Generate maximum 10 questions by default. No lengthy explanations — 1-2 sentences per answer explanation.' },
  'explain-like-10':        { tier: 'light', maxOutput: 'Keep explanation under 200 words.' },
  'flashcards-generator':   { tier: 'light', maxOutput: 'Generate maximum 15 flashcards. Keep each card concise (front: 1 line, back: 1-3 lines).' },
  'hook-generator':         { tier: 'light', maxOutput: 'Generate exactly 10 hooks. Keep each under 20 words.' },
  'business-name-generator':{ tier: 'light', maxOutput: 'Generate 15 name ideas. Keep each entry to 2-3 lines max.' },
  'business-idea-generator':{ tier: 'light', maxOutput: 'Generate 5 business ideas. Keep each under 80 words.' },
  'study-planner':          { tier: 'light', maxOutput: 'Keep the plan under 500 words.' },
  'past-questions':         { tier: 'light', maxOutput: 'Generate maximum 10 questions with brief marking schemes.' },
  'study-notes-generator':  { tier: 'light', maxOutput: 'Keep notes under 500 words. Be concise — bullet points over paragraphs.' },
  'pitch-deck-generator':   { tier: 'light', maxOutput: 'Keep total output under 600 words. Be punchy — slides should be concise.' },
  'marketing-copy':         { tier: 'light', maxOutput: 'Keep output under 500 words unless user specifies otherwise.' },
  'sales-copy-generator':   { tier: 'light', maxOutput: 'Keep output under 600 words unless user specifies otherwise.' },
  'ai-image-generator':     { tier: 'light', maxOutput: '' },

  // Heavy tasks — long-form, complex generation
  'essay-writer':           { tier: 'heavy', maxOutput: 'Write 500-600 words unless the user specifies a different length.' },
  'thesis-writer':          { tier: 'heavy', maxOutput: 'Keep output under 1200 words per section. Be thorough but not repetitive.' },
  'research-proposal':      { tier: 'heavy', maxOutput: 'Keep output under 1000 words unless user specifies otherwise.' },
  'literature-review':      { tier: 'heavy', maxOutput: 'Keep output under 1000 words unless user specifies otherwise.' },
  'academic-template':      { tier: 'heavy', maxOutput: 'Keep output under 800 words.' },
  'book-writer':            { tier: 'heavy', maxOutput: 'Keep output under 1500 words per section.' },
  'chapter-builder':        { tier: 'heavy', maxOutput: 'Keep output under 1500 words.' },
  'copywriting-assistant':  { tier: 'heavy', maxOutput: 'Keep output under 800 words unless user specifies otherwise.' },
  'course-outline':         { tier: 'heavy', maxOutput: 'Keep output under 800 words.' },
  'research-paper':         { tier: 'heavy', maxOutput: 'Keep output under 1200 words per section.' },
  'business-plan-builder':  { tier: 'heavy', maxOutput: 'Keep output under 1200 words per section.' },
  'script-generator':       { tier: 'heavy', maxOutput: 'Keep output under 800 words unless user specifies otherwise.' },
};

export function getToolLimits(toolId: string): { tier: ToolTier; maxOutput: string } {
  return TOOL_LIMITS[toolId] || { tier: 'heavy', maxOutput: '' };
}

export const FREE_GENERATOR_IDS = new Set([
  'homework-helper',
]);

const TOOL_CREDIT_COSTS: Record<string, number> = {
  'essay-writer': 3,
  'thesis-writer': 5,
  'research-proposal': 4,
  'literature-review': 4,
  'academic-template': 2,
  'book-writer': 6,
  'chapter-builder': 3,
  'copywriting-assistant': 2,
  'course-outline': 2,
  'research-paper': 5,
  'business-plan-builder': 3,
  'pitch-deck-generator': 2,
  'sales-copy-generator': 2,
  'script-generator': 2,
  'marketing-copy': 2,
  'quiz-generator': 1,
  'explain-like-10': 1,
  'flashcards-generator': 1,
  'study-notes-generator': 1,
  'study-planner': 1,
  'past-questions': 1,
  'hook-generator': 1,
  'business-name-generator': 1,
  'business-idea-generator': 1,
  'resume-builder': 1,
  'email-writer': 1,
};

export function isFreeGenerator(toolId: string): boolean {
  return FREE_GENERATOR_IDS.has(toolId);
}

export function getToolCreditCost(toolId: string): number {
  return TOOL_CREDIT_COSTS[toolId] ?? (getToolLimits(toolId).tier === 'light' ? 1 : 3);
}