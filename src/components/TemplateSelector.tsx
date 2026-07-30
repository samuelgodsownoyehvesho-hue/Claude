import { useState } from "react";
import { motion } from "motion/react";
import { TEMPLATES } from "../templates";
import { Template } from "../types";
import { Sparkles, Eye, Grid3X3, Film, PlayCircle, Star } from "lucide-react";

interface TemplateSelectorProps {
  selectedTemplateId: string;
  onSelectTemplate: (template: Template) => void;
}

const CATEGORIES = ["All", "Claude", "Standard", "Kinetic", "Retro", "Elegant", "Layouts", "Flow", "Action", "3D", "Typing"];

export default function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredTemplates = TEMPLATES.filter((t) => {
    if (activeCategory === "All") return true;
    return t.category.toLowerCase() === activeCategory.toLowerCase();
  });

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 overflow-hidden shadow-xl" id="template-selector-panel">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-indigo-400" />
          <h3 className="text-md font-semibold text-slate-100 font-sans tracking-tight">
            Kinetic Templates
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-md">
          {TEMPLATES.length} templates
        </span>
      </div>

      {/* Categories Horizontal Scroller */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none" id="category-tabs">
        {CATEGORIES.map((cat) => {
          const isActive = cat === activeCategory;
          const hasTemplates = cat === "All" || TEMPLATES.some(t => t.category.toLowerCase() === cat.toLowerCase());
          if (!hasTemplates) return null;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1 max-h-[360px] md:max-h-none" id="templates-grid">
        {filteredTemplates.map((template, idx) => {
          const isSelected = template.id === selectedTemplateId;
          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.02 }}
              onClick={() => onSelectTemplate(template)}
              className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                isSelected
                  ? "bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/30"
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-850/60"
              }`}
              id={`template-card-${template.id}`}
            >
              {/* Colored Theme Swatch */}
              <div className="absolute top-0 left-0 w-full h-1.5 flex">
                <div className="flex-1" style={{ backgroundColor: template.palette.bg }} />
                <div className="flex-1" style={{ backgroundColor: template.palette.text }} />
                <div className="flex-1" style={{ backgroundColor: template.palette.active }} />
                <div className="flex-1" style={{ backgroundColor: template.palette.accent }} />
              </div>

              <div className="flex items-start justify-between mt-1 mb-1.5">
                <h4 className="text-sm font-semibold text-slate-200 font-sans tracking-tight group-hover:text-indigo-400 transition-colors">
                  {template.name}
                </h4>
                <span className="text-[10px] font-mono bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded">
                  {template.category}
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-normal flex-1">
                {template.description}
              </p>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-900 text-[11px] text-slate-500">
                <span className="font-mono">
                  Font: {template.font.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: template.palette.accent }} />
                  <span className="font-mono">{template.palette.name}</span>
                </div>
              </div>

              {isSelected && (
                <div className="absolute right-2 top-2 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                  <Star className="w-3 h-3 fill-white" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
