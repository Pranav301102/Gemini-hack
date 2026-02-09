'use client'

import React from 'react'
import Link from 'next/link'
import { HiCog, HiLightningBolt, HiUserGroup, HiChip, HiCode, HiCheckCircle } from 'react-icons/hi'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiCog className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Agent Weaver</h1>
          </div>
          <Link
            href="https://github.com/yourusername/agent-weaver"
            target="_blank"
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
          <HiLightningBolt className="w-3 h-3" />
          Built for the Gemini 3 Hackathon
        </div>
        
        <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
          5 AI Agents.<br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            One Shared Brain.
          </span>
        </h2>
        
        <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
          Turn Gemini into a coordinated team of specialized AI agents with persistent memory, 
          human-verified annotations, and git-based team collaboration. No more agent amnesia.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard?demo=true"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-2"
          >
            <HiChip className="w-5 h-5" />
            See Demo
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors flex items-center gap-2"
          >
            <HiChip className="w-5 h-5" />
            Open Dashboard
          </Link>
          <a
            href="#setup"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Get Started
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<HiChip className="w-6 h-6" />}
            title="Shared Agent Memory"
            description="All 5 agents read from and write to a persistent context board. No re-reading. No duplicate work."
          />
          <FeatureCard
            icon={<HiUserGroup className="w-6 h-6" />}
            title="Team Collaboration"
            description="Git-based sharing + Hub sync. One teammate scans, the whole team benefits."
          />
          <FeatureCard
            icon={<HiCheckCircle className="w-6 h-6" />}
            title="Human Verification"
            description="Agents write code annotations. Humans verify them. Trust builds over time."
          />
          <FeatureCard
            icon={<HiCode className="w-6 h-6" />}
            title="AST-Powered Indexing"
            description="Tree-sitter parses your code. LLM enriches every symbol. Search by meaning."
          />
          <FeatureCard
            icon={<HiLightningBolt className="w-6 h-6" />}
            title="55 MCP Tools"
            description="19 modules across indexing, planning, agents, team collab, and hub sync."
          />
          <FeatureCard
            icon={<HiCog className="w-6 h-6" />}
            title="Real-Time Dashboard"
            description="Next.js dashboard with live SSE updates. See agents work in real-time."
          />
        </div>
      </section>

      {/* Setup Section */}
      <section id="setup" className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6">🚀 Run Locally</h3>
          
          <div className="space-y-6">
            <Step
              number={1}
              title="Clone & Build MCP Server"
              code={`git clone https://github.com/yourusername/agent-weaver.git
cd agent-weaver
npm install
npm run build`}
            />
            
            <Step
              number={2}
              title="Install Dashboard"
              code={`cd dashboard
npm install`}
            />
            
            <Step
              number={3}
              title="Start Hub Server (optional for team sync)"
              code={`cd ../hub
npm install
npm start &  # Runs on http://localhost:4200`}
            />
            
            <Step
              number={4}
              title="Launch Dashboard"
              code={`cd ../dashboard
export WEAVER_PROJECT_PATH=/path/to/your/project
npm run dev`}
            />
            
            <Step
              number={5}
              title="Add to Gemini CLI"
              code={`# Add to your Gemini config:
{
  "mcpServers": {
    "agent-weaver": {
      "command": "node",
      "args": ["/path/to/agent-weaver/dist/index.js"]
    }
  }
}`}
            />
          </div>

          <div className="mt-8 p-4 bg-blue-950/30 border border-blue-800/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>💡 Tip:</strong> Point <code className="bg-blue-900/50 px-1.5 py-0.5 rounded text-xs">WEAVER_PROJECT_PATH</code> to any 
              git repo. The dashboard will auto-load .weaver/ data and display agent activity in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-white mb-4">Built With</h3>
          <p className="text-gray-400">Powered by the latest AI and web technologies</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TechBadge name="Gemini 3 Pro" />
          <TechBadge name="TypeScript" />
          <TechBadge name="Next.js 15" />
          <TechBadge name="React 19" />
          <TechBadge name="MCP SDK" />
          <TechBadge name="Express.js" />
          <TechBadge name="Tailwind CSS 4" />
          <TechBadge name="Tree-sitter" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950/50">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-gray-500 text-sm">
          <p>Built for the <strong className="text-white">Gemini 3 Hackathon</strong> • February 2026</p>
          <p className="mt-2">Made with 🤖 by humans and AI agents working in sync</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
        {icon}
      </div>
      <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}

function Step({ number, title, code }: { number: number; title: string; code: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
          {number}
        </div>
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-gray-300 font-mono">{code}</code>
      </pre>
    </div>
  )
}

function TechBadge({ name }: { name: string }) {
  return (
    <div className="px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-center">
      <span className="text-sm font-medium text-gray-300">{name}</span>
    </div>
  )
}
