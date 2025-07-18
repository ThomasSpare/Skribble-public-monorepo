const TIER_LIMITS = {
  free: {
    maxProjects: 1,
    maxCollaborators: 1,
    allowedExportFormats: []
  },
  indie: {
    maxProjects: 5,
    maxCollaborators: 2,
    allowedExportFormats: ['wav_with_cues']
  },
  producer: {
    maxProjects: 20,
    maxCollaborators: 10,
    allowedExportFormats: ['wav_with_cues', 'reaper_project', 'pro_tools', 'logic_pro', 'ableton']
  },
  studio: {
    maxProjects: -1, // unlimited
    maxCollaborators: 20,
    allowedExportFormats: ['wav_with_cues', 'reaper_project', 'pro_tools', 'logic_pro', 'ableton']
  }
};

function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

module.exports = { TIER_LIMITS, getTierLimits };