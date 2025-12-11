import { motion } from 'framer-motion';
import { Database } from '../services/Database';
import type { Unit } from '../types';

export const UnitCard = ({ unit, index }: { unit: Unit, index: number }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            className="group relative bg-cyber-panel/40 backdrop-blur-sm border border-cyber-border rounded-lg p-5 overflow-hidden hover:border-cyber-primary/50 transition-colors"
        >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyber-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10 flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-white group-hover:text-cyber-primary transition-colors tracking-tight">
                    {unit.name}
                </h3>
                <span className="text-[10px] font-mono text-cyber-muted border border-cyber-border px-1.5 py-0.5 rounded bg-black/20">
                    {unit.isc}
                </span>
            </div>

            {/* Faction Pills */}
            <div className="relative z-10 flex flex-wrap gap-1.5 mt-4">
                {unit.factions.slice(0, 3).map(fid => (
                    <span
                        key={fid}
                        className="text-[10px] uppercase font-bold tracking-wider bg-cyber-bg/50 border border-white/5 px-2 py-1 rounded text-cyber-muted group-hover:border-cyber-primary/20 transition-colors"
                    >
                        {Database.getInstance().getFactionName(fid)}
                    </span>
                ))}
                {unit.factions.length > 3 && (
                    <span className="text-[10px] font-bold bg-cyber-bg/50 px-2 py-1 rounded text-cyber-muted">
                        +{unit.factions.length - 3}
                    </span>
                )}
            </div>

            {/* Corner Accent */}
            <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
                <div className="absolute bottom-2 right-2 w-1 h-1 bg-cyber-primary opacity-0 group-hover:opacity-100 transition-opacity delay-100" />
                <div className="absolute bottom-2 right-4 w-0.5 h-0.5 bg-cyber-primary opacity-0 group-hover:opacity-100 transition-opacity delay-150" />
            </div>
        </motion.div>
    );
};
