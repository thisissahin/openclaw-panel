import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getSkills, toggleSkill } from '../../api'

type Skill = {
  name: string
  enabled: boolean
}

type SkillsTabProps = {
  toast: (message: string) => void
}

export default function SkillsTab({ toast }: SkillsTabProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await getSkills()
      const list = [...(response.skills.active || []), ...(response.skills.disabled || [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      setSkills(list)
    } catch (error: any) {
      toast(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const onToggle = async (name: string, currentValue: boolean) => {
    try {
      toast(`Updating ${name}...`)
      await toggleSkill(name, !currentValue)
      setSkills(previous => previous.map(skill => (skill.name === name ? { ...skill, enabled: !currentValue } : skill)))
      toast(`${name} ${!currentValue ? 'enabled' : 'disabled'} ✅`)
    } catch (error: any) {
      toast(`Error: ${error.message}`)
    }
  }

  return (
    <div className="tab-content" style={{ overflowY: 'auto' }}>
      <div className="status-bar ok" style={{ marginBottom: '4px', flexShrink: 0 }}>
        <span>Toggle skills to save tokens</span>
        <button className="icon-btn" onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>
      {loading && <div className="center-msg">Loading...</div>}
      <div className="skill-list">
        {skills.map(skill => (
          <div key={skill.name} className="skill-item">
            <div className="skill-info">
              <span className="skill-name">{skill.name}</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={skill.enabled} onChange={() => onToggle(skill.name, skill.enabled)} />
              <span className="slider" />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
