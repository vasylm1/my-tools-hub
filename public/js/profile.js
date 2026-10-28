// Content for the About, Privacy and Legal notice pages. Edit this file to change them: no other code needs to change.
// Everything here is published, so keep it to what you are happy to show. Source: the CV and the earlier personal website.

export const profile = {
  name: 'Vasyl Madei',
  photo: '/img/vasyl-madei.jpg',
  role: 'Product Marketing Professional and Tech Enthusiast',
  location: 'Warsaw, Poland',
  headline: 'I market lighting by day and build small, private software by night.',
  summary: [
    'I am a data-driven product marketer with more than three years of experience in product launches, portfolio management and digital transformation across European markets. I combine strategic marketing thinking with technical execution in Power BI, SAP and Power Platform.',
    'Alongside work I study Marketing Business Management for my master’s degree and completed a postgraduate programme in Innovation Management, taught in German. I build the tools I wish existed, usually with AI-assisted development, and keep them local-first and privacy-respecting.',
    'This site is one of them: a toolbox that runs entirely in your browser, written in plain HTML, CSS and JavaScript.',
  ],
  focus: [
    { icon: 'tag', title: 'Go-to-market', text: 'Launch planning, product positioning and portfolio and category management for European markets.' },
    { icon: 'linechart', title: 'Data and automation', text: 'Power BI, Power Automate, Power Apps, SQL and SAP data governance, plus n8n for the repetitive parts.' },
    { icon: 'code', title: 'Small software', text: 'Converters, generators and dashboards that do one job well and keep your data on your device.' },
  ],
  // Figures shown as highlights on the About page (from the current role at Signify).
  impact: [
    { value: '13', label: 'product families' },
    { value: '18', label: 'European countries' },
    { value: '1,000+', label: 'people across Europe using these reports' },
    { value: '15', label: 'product training sessions' },
  ],
  experience: [
    { role: 'Product Marketing Manager', org: 'Signify (formerly Philips Lighting)', place: 'Warsaw', period: 'Feb 2025 to present', points: [
      'Manage portfolio strategy and lifecycle execution for 13 product families across 18 European countries within a multi-million-euro portfolio.',
      'Coordinate 3 to 4 product launches per year, inventory requirements, quarterly financial planning, and sales and margin performance with regional market teams.',
      'Delivered 2 Power Apps and 7 Power BI reports for a Europe-wide user base of 1,000+, saving up to 10 hours of manual work per week.',
      'Developed an AI-assisted product-benchmarking tool and delivered 15 product-training sessions across European markets.',
      'Led the “Excellent Adventure” team in developing a suite of internal process-improvement tools, advancing to the Global Final of Signify’s SEC innovation competition.',
    ] },
    { role: 'CEE Product Marketing Intern', org: 'Signify (formerly Philips Lighting)', place: 'Warsaw', period: 'Dec 2023 to Jan 2025', points: [
      'Built Power Platform solutions for workflow and reporting automation using Power Apps, Power Automate, Power BI and SharePoint.',
      'Maintained SAP product data and supported product benchmarking, website content quality, and sales and margin analysis.',
      'Introduced an AI-assisted document translation workflow and rebuilt the internal product wiki from the ground up.',
      'Created training materials, newsletters and product certifications to support regional sales enablement.',
    ] },
    { role: 'Office Support', org: 'SAMSIC Polska', place: 'Warsaw Metropolitan Area', period: 'Sep 2022 to Oct 2023', note: 'Employed by Samsic Poland, contracted to Procter & Gamble (P&G).', points: [
      'Built dynamic performance reports using Excel (Power Query, VBA) for leadership visibility.',
      'Assisted executives with administrative workflows and optimised operations using Microsoft 365.',
      'Resolved technical issues with office equipment, minimising downtime across the office.',
    ] },
    { role: 'Printer Servicer', org: '', place: 'Warsaw, Poland', period: 'Jan 2021 to Jun 2022', points: [
      'Diagnosed and troubleshot printer issues.',
      'Repaired and replaced printer components as needed.',
      'Installed and configured printers for use on various networks and systems.',
    ] },
  ],
  education: [
    { title: 'Master’s, Marketing Business Management', org: 'VIZJA University (AEH), Warsaw', period: '2025 to 2027' },
    { title: 'Postgraduate, Innovation Management (in German)', org: 'Allensbach Hochschule Konstanz, online', period: '2025' },
    { title: 'Bachelor’s, Marketing in the Enterprise', org: 'University of Economics and Human Sciences (AEH), Warsaw', period: '2022 to 2025' },
    { title: 'Junior Specialist, Economics of Enterprise', org: 'Sambir Technical College of Economics and Computer Sciences, Ukraine', period: '2017 to 2019' },
  ],
  skills: [
    { group: 'Marketing and strategy', items: ['Product marketing', 'GTM strategy', 'Launch planning', 'Product positioning', 'Portfolio and category management', 'Market research', 'Marketing automation'] },
    { group: 'Data and tools', items: ['Power BI', 'Excel (VBA, Power Query)', 'Power Automate', 'Power Apps', 'SAP data governance', 'SQL', 'Snowflake', 'SharePoint'] },
    { group: 'AI and automation', items: ['AI workflow automation', 'n8n', 'Zapier', 'No-code and low-code'] },
    { group: 'Design and web', items: ['HTML', 'CSS', 'JavaScript', 'Python', 'WordPress', 'Adobe Creative Suite', 'Canva'] },
  ],
  projects: [
    { name: 'My Tools Hub', text: 'This site: 46 private tools for writing, data, documents and images.', href: 'https://github.com/vasylm1/my-tools-hub' },
    { name: 'Markdown Reader', text: 'A free Markdown viewer and editor for Windows, macOS, Linux and the web.', href: 'https://markdown-reader-editor.netlify.app' },
    { name: 'Image2BI', text: 'Turns images into Power BI-ready assets in your browser, with Data URI optimisation and batch XLSX export.', href: 'https://custom-card-generator-1.netlify.app' },
    { name: 'CRM', text: 'Small CRM, personal scale. Contacts, reminders and notes on the web and on Android, with phone contact sync.' },
    { name: 'Local Secrets MCP', text: 'A small local secrets store with an MCP server that lets AI assistants use credentials without ever seeing them. Includes a command-line tool and a web interface that only works on your own machine.' },
    { name: 'Analytics Hub', text: 'A Streamlit dashboard that brings Google Search Console and Umami together in one view of how a website performs.' },
    { name: 'Crew Expense Tracker', text: 'A browser-based tracker for shared expenses on trips and events: fair splits, live balances and a simple settlement plan. Everything stays in the browser.' },
    { name: 'University Schedule Converter', text: 'A multilingual Excel-to-ICS tool with drag and drop (English, Polish, Ukrainian).' },
    { name: 'AI-powered personal finance system', text: 'A self-hosted tracker with expense logging, AI categorisation, SQL sync and AI-written reports by email.' },
    { name: 'Homelab dashboard', text: 'A physical and web dashboard for a self-hosted home server.' },
  ],
  languages: [
    { name: 'Ukrainian', level: 'C2' },
    { name: 'Russian', level: 'C2' },
    { name: 'Polish', level: 'C1' },
    { name: 'English', level: 'C1' },
    { name: 'German', level: 'B2' },
    { name: 'Spanish', level: 'A2' },
    { name: 'Chinese', level: 'A1' },
  ],
  certifications: ['Inbound Marketing (HubSpot)', 'Generative AI for PMs (IBM)', 'SAP Analytics Cloud', 'Digital Transformation (MIT)', 'Python in Excel (XelPlus)', 'AI and Productivity (Google)', 'Digital Marketing (University of Chicago)', 'Marketing Automation (Santander)', 'E-Commerce and Sales (IE University)', 'Lean Foundation (Signify)'],
  email: 'vasylmadei@gmail.com',
  links: [
    { label: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com/in/vasyl-madei/' },
    { label: 'GitHub', icon: 'github', href: 'https://github.com/vasylm1' },
  ],
};

// Facts shown on the Privacy and Legal notice pages (GDPR Art. 13, e-Commerce Directive Art. 5).
export const legal = {
  controller: 'Vasyl Madei',
  country: 'Poland',
  email: profile.email,
  updated: '27 October 2026',
  authority: { name: 'Prezes Urzędu Ochrony Danych Osobowych (UODO), Poland', href: 'https://uodo.gov.pl/en' },
};
