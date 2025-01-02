interface AgentConfig {
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  githubPath: string;
  configFile: string;
}

export const AGENT_LIST: AgentConfig[] = [
  {
    name: 'DIY Expert',
    description: 'An AI expert in DIY projects and home improvements',
    category: 'Expert Systems',
    tags: ['DIY', 'Home Improvement', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'bolt.diy-expert',
    configFile: 'bolt_diy_Expert.json',
  },
  {
    name: 'Advanced Web Researcher',
    description: 'Advanced AI agent for comprehensive web research',
    category: 'Research & Analysis',
    tags: ['Web Research', 'Document Processing'],
    author: 'Cole Medin',
    githubPath: 'advanced-web-researcher',
    configFile: 'advanced_web_researcher.json',
  },
  {
    name: 'LinkedIn/X/Blog Content Creator',
    description: 'AI agent for creating engaging social media content',
    category: 'Content Creation',
    tags: ['Content Writing', 'Social Media', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'linkedin-x-blog-content-creator',
    configFile: 'linkedin_x_blog_content_creator.json',
  },
  {
    name: 'Local AI Expert',
    description: 'Expert AI agent for local development and deployment',
    category: 'Development',
    tags: ['AI', 'Development', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'local-ai-expert',
    configFile: 'local_ai_expert.json',
  },
  {
    name: 'N8N Expert',
    description: 'Expert AI agent for n8n automation workflows',
    category: 'Automation',
    tags: ['N8N', 'Automation', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'n8n-expert',
    configFile: 'n8n_expert.json',
  },
  {
    name: 'N8N GitHub Assistant',
    description: 'AI assistant for GitHub automation with n8n',
    category: 'Development',
    tags: ['GitHub', 'N8N', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'n8n-github-assistant',
    configFile: 'n8n_github_assistant.json',
  },
  {
    name: 'Pydantic AI Web Researcher',
    description: 'AI researcher using Pydantic for structured data',
    category: 'Research & Analysis',
    tags: ['Web Research', 'Python', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'pydantic-ai-advanced-researcher',
    configFile: 'pydantic_ai_advanced_researcher.json',
  },
  {
    name: 'Small Business Researcher',
    description: 'AI agent specialized in small business research',
    category: 'Business',
    tags: ['Business Research', 'Analysis', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'small-business-researcher',
    configFile: 'small_business_researcher.json',
  },
  {
    name: 'Tech Stack Expert',
    description: 'Expert AI agent for technology stack decisions',
    category: 'Technology',
    tags: ['Tech Stack', 'Architecture', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'tech-stack-expert',
    configFile: 'tech_stack_expert.json',
  },
  {
    name: 'YouTube Video Summarizer',
    description: 'AI agent that summarizes YouTube videos',
    category: 'Content Analysis',
    tags: ['YouTube', 'Summarization', 'Assistant'],
    author: 'Cole Medin',
    githubPath: 'youtube-video-summarizer',
    configFile: 'youtube_video_summarizer.json',
  },
];

export async function loadAgentConfig(githubPath: string, configFile: string) {
  const baseUrl = 'https://raw.githubusercontent.com/coleam00/ottomator-agents/main';
  const response = await fetch(`${baseUrl}/${githubPath}/${configFile}`);

  if (!response.ok) {
    throw new Error(`Failed to load agent config: ${response.statusText}`);
  }

  return response.json();
}
