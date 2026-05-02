import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "content/site-data.json", "public/chatbot-knowledge.txt"]
  }
];

export default eslintConfig;
