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
  experience: [
    { role: 'Product Marketeer', org: 'Signify', place: 'Warsaw', period: 'Feb 2025 to present', points: [
      'Develop and run product marketing strategy for an assigned portfolio across European markets.',
      'Manage the full portfolio, including market introductions, inventory planning and QxP financial planning.',
      'Build Power Platform solutions that streamline reporting, and lead sales and margin management.',
      'Train regional teams across Europe on products.',
    ] },
    { role: 'Product Marketing Intern', org: 'Signify', place: 'Warsaw', period: 'Dec 2023 to Jan 2025', points: [
      'Designed and deployed Power Automate, Power Apps, Power BI and SharePoint solutions that automate workflows.',
      'Managed SAP data governance, benchmarked products and kept website content accurate.',
      'Created training materials, newsletters and certifications, and analysed sales and margin.',
      'Built and maintained an internal product wiki used for team training.',
    ] },
    { role: 'Office Assistant', org: 'Samsic Poland for P&G', place: 'Warsaw', period: 'Sep 2022 to Oct 2023', points: [
      'Built performance reports in Excel with Power Query and VBA for leadership.',
      'Supported executives and streamlined office operations with Microsoft 365.',
    ] },
    { role: 'Printer Technician', org: 'Best Black', place: 'Warsaw', period: 'Jan 2021 to Jun 2022', points: [] },
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
    { name: 'My Tools Hub', text: 'This site: 43 private tools for writing, data, documents and images.', href: 'https://github.com/vasylm1/my-tools-hub' },
    { name: 'University Schedule Converter', text: 'A multilingual Excel-to-ICS tool with drag and drop (English, Polish, Ukrainian).' },
    { name: 'GrineGóra Heritage Website', text: 'A multilingual community website with a Shopify store, built on Netlify and automated with n8n.' },
    { name: 'AI-powered personal finance system', text: 'A self-hosted tracker with expense logging, AI categorisation, SQL sync and AI-written reports by email.' },
    { name: 'Markdown Reader', text: 'A privacy-focused reader and editor for Markdown notes.' },
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
  analyticsHost: 'static.vasylautomation.org',
};
