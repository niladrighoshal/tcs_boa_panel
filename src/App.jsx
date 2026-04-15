
import { useEffect, useMemo, useState } from 'react'
import Login from './Login'
import {
  FiArchive,
  FiCalendar,
  FiCheck,
  FiClock,
  FiCopy,
  FiDownload,
  FiEdit2,
  FiFilter,
  FiMenu,
  FiPhone,
  FiPlus,
  FiSave,
  FiSettings,
  FiShare2,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import { FaGithub, FaWhatsapp } from 'react-icons/fa'
import { EMPLOYEE_DIRECTORY, findDirectoryByEmpId, findDirectoryByName } from './employeeDirectory'

const STORAGE_KEY = 'boa_panel_manager_v1'
const STORAGE_VERSION = 2
const STATUS_OPTIONS = ['Pending', 'Available', 'Not Available', 'No Response', 'Call Back Later', 'Force Assign']
const DRIVE_TYPES = ['Virtual Drive', 'Physical Drive']
const PHYSICAL_LOCATIONS = ['Chennai', 'Hyderabad', 'Bangalore', 'Mumbai', 'Ahmedabad', 'Indore']

const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const normalizePhone = (phone) => phone.replace(/\s+/g, ' ').trim()
const toWhatsappNumber = (phone) => phone.replace(/[^\d]/g, '')
const getWhatsappChatUrl = (phone, text = '') => {
  const number = toWhatsappNumber(phone)
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`
}
const getWhatsappCallUrl = (phone) => `whatsapp://call?phone=${toWhatsappNumber(phone)}`
const isValidQuarterHourSlot = (value) => {
  if (!value) return false
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return false
  return m === 0 || m === 15 || m === 30 || m === 45
}
const normalizeTimeSlot = (value, fallback = '10:00') => (isValidQuarterHourSlot(value) ? value : fallback)
const WORK_HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => 10 + index)
const MINUTE_OPTIONS = ['00', '15', '30', '45']

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return ''
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const fmtTime = (value) => {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m, 0, 0)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const addTwoHours = (value) => {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m, 0, 0)
  date.setHours(date.getHours() + 2)
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

const getNextDateIso = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

const formatDriveText = (driveType, location) => {
  if (driveType === 'Physical Drive' && location) {
    return `physical drive at ${location}`
  }
  return 'virtual drive'
}

const buildForceAssignMessage = ({
  associateName,
  myName,
  date,
  driveType,
  location,
  technologyName,
  role,
  start,
  end,
}) =>
  `Hi ${associateName}, I am ${myName} from TCS Bank of America. On ${formatDisplayDate(date)} we have a ${formatDriveText(driveType, location)}. I am suggesting your name as ${role === 'TR' ? `${technologyName} interviewer` : 'Managerial Round'} from ${fmtTime(start)} - ${fmtTime(end)}. Please cooperate to fulfill this drive. Thanks.`

const sortByRecommendation = (pool, history, role, technologyId, selectedDate) => {
  const target = new Date(`${selectedDate}T00:00:00`)
  const yesterday = new Date(target)
  yesterday.setDate(target.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  return [...pool].sort((a, b) => {
    const aEntries = history.filter((item) =>
      role === 'TR' ? item.trId === a.id && item.technologyId === technologyId : item.mrId === a.id,
    )
    const bEntries = history.filter((item) =>
      role === 'TR' ? item.trId === b.id && item.technologyId === technologyId : item.mrId === b.id,
    )
    const aLast = aEntries.length ? aEntries[aEntries.length - 1].date : ''
    const bLast = bEntries.length ? bEntries[bEntries.length - 1].date : ''
    const aWasYesterday = aLast === yesterdayKey
    const bWasYesterday = bLast === yesterdayKey

    if (aWasYesterday !== bWasYesterday) return aWasYesterday ? 1 : -1
    if (!aLast && bLast) return -1
    if (aLast && !bLast) return 1
    if (aLast !== bLast) return aLast < bLast ? -1 : 1
    if (aEntries.length !== bEntries.length) return aEntries.length - bEntries.length
    return a.name.localeCompare(b.name)
  })
}

const buildMessage = ({
  recipient,
  date,
  driveType,
  driveLocation,
  technologyName,
  count,
  tr,
  mr,
  trStart,
  trEnd,
  mrStart,
  mrEnd,
}) => {
  const locationLine = driveType === 'Physical Drive' ? `\nLocation: ${driveLocation || 'TBD'}` : ''
  return `Hi ${recipient},

Please find ${formatDisplayDate(date)} panellists' details from Mohana's team.
Date: ${formatDisplayDate(date)}
Drive Type: ${driveType}
${locationLine}
Skill: ${technologyName}
Interview Count: ${count}
TR EMP: ${tr.empId || 'TBD'}
TR Name: ${tr.name}
TR Contact: ${tr.phone}
TR Grade: ${tr.grade}
TR Timings: ${fmtTime(trStart)} - ${fmtTime(trEnd)}
MR EMP: ${mr.empId || 'TBD'}
MR Name: ${mr.name}
MR Contact: ${mr.phone}
MR Grade: ${mr.grade}
MR Timings: ${fmtTime(mrStart)} - ${fmtTime(mrEnd)}`
}

function TimeSlotPicker({ value, onChange }) {
  const normalized = normalizeTimeSlot(value, '10:00')
  const [hourRaw, minuteRaw] = normalized.split(':')
  const hour = Number(hourRaw)
  const minute = minuteRaw === '30' ? '30' : '00'

  return (
    <div className="time-picker">
      <select
        value={Number.isNaN(hour) ? 10 : hour}
        onChange={(e) => onChange(`${String(Number(e.target.value)).padStart(2, '0')}:${minute}`)}
      >
        {WORK_HOUR_OPTIONS.map((slotHour) => (
          <option key={slotHour} value={slotHour}>
            {fmtTime(`${String(slotHour).padStart(2, '0')}:00`).replace(':00', '')}
          </option>
        ))}
      </select>
      <select value={minute} onChange={(e) => onChange(`${String(hour).padStart(2, '0')}:${e.target.value}`)}>
        {MINUTE_OPTIONS.map((slotMinute) => (
          <option key={slotMinute} value={slotMinute}>
            {slotMinute}
          </option>
        ))}
      </select>
    </div>
  )
}

const defaultTechnologies = ['Java', 'Dot Net', 'Python', 'Automation Testing', 'PLSQL', 'Informatica'].map((name) => ({
  id: createId(),
  name,
  active: true,
}))

const getTechId = (techList, name) => techList.find((tech) => tech.name === name)?.id

const buildSeedData = () => {
  const technologies = defaultTechnologies
  const associates = [
    ['Abhishek Jain', '1213620', '+91 73871 81767', 'TR', 'Java', 'C3A'],
    ['Sravani Miriyala', '1612445', '+91 98925 05762', 'TR', 'Java', 'C3A'],
    ['Rakesh Konduru', '2363338', '+91 94949 94854', 'TR', 'Java', 'C3A'],
    ['M Aarthy', '2727718', '+91 93617 87050', 'TR', 'Java', 'C3A'],
    ['Chinmayi Naga Paranandi', '2123111', '+91 81060 19440', 'TR', 'Dot Net', 'C3A'],
    ['Sandip Lakum', '2495365', '+91 76989 68097', 'TR', 'Dot Net', 'C3A'],
    ['Pooja Singh', '2461315', '+91 91670 14597', 'TR', 'Dot Net', 'C3A'],
    ['Suranjan Dasgupta', '1120529', '+91 82768 48451', 'TR', 'Python', 'C3A'],
    ['Deepak Kumar', '2705406', '+91 79031 24549', 'TR', 'Python', 'C3A'],
    ['Viresh Kumar', '2764880', '+91 87911 21878', 'TR', 'Python', 'C3A'],
    ['Ramyalakshmi K', '495827', '+91 86005 60133', 'TR', 'Python', 'C3A'],
    ['Vishal Singh Gurjar', '2853124', '+91 95759 96699', 'TR', 'Automation Testing', 'C3A'],
    ['Karthik B S', '314791', '+91 93454 41214', 'TR', 'Automation Testing', 'C3A'],
    ['Kamalakar L Naik', '2342284', '+91 97407 53299', 'TR', 'Automation Testing', 'C3A'],
    ['Sudeep Kumar', '1027345', '+91 89622 99916', 'TR', 'PLSQL', 'C3A'],
    ['Satya Nikitha Kattuboina', '2622563', '+91 95502 97320', 'TR', 'PLSQL', 'C3A'],
    ['Suman Saroj Khuntia', '2713033', '+91 824 941 7044', 'TR', 'PLSQL', 'C3A'],
    ['Janmejay Shanti', '2424221', '+91 96322 44667', 'TR', 'PLSQL', 'C3A'],
    ['Vignesh Subramanian', '892664', '+91 99411 69750', 'TR', 'Informatica', 'C3A'],
    ['Mukesh Kumar Singh', '2764087', '+91 91234 17283', 'TR', 'Informatica', 'C3A'],
    ['Atul Gupta', '922852', '+91 70305 16655', 'MR', '', 'C3B'],
    ['Jayachander Lakavath', '2299252', '+91 70936 93774', 'MR', '', 'C3B'],
    ['Uma Maheswari V', '204189', '+91 97109 12000', 'MR', '', 'C3B'],
    ['Mukesh Kumar Singh', '2764087', '+91 91234 17283', 'MR', '', 'C3B'],
    ['Ajaykumar B', '516081', '+91 97901 81008', 'MR', '', 'C3B'],
    ['Suman Saroj Khuntia', '2713033', '+91 824 941 7044', 'MR', '', 'C3B'],
  ].map(([name, empId, phone, role, techName, grade]) => ({
    id: createId(),
    name,
    phone: normalizePhone(phone),
    role,
    technologyIds: techName ? [getTechId(technologies, techName)] : [],
    grade,
    empId,
    location: '',
    active: true,
    notes: '',
  }))

  return {
    technologies,
    associates,
    history: [],
    recipients: ['Balaji', 'Mohana'],
    myName: 'Niladri Ghoshal',
    gradeLevels: ['C3A', 'C3B', 'C3C', 'C4', 'C5'],
  }
}

const seed = buildSeedData()
const canonicalAssociateByPhoneRole = new Map(
  seed.associates.map((person) => [`${toWhatsappNumber(person.phone)}|${person.role}`, person]),
)

const migrateTechnologies = (technologies = []) =>
  technologies.map((tech) => (tech.name === '.NET' ? { ...tech, name: 'Dot Net' } : tech))

const migrateAssociates = (associates = [], technologies = []) => {
  const dotNetTech = technologies.find((tech) => tech.name === 'Dot Net')
  const legacyDotNetTech = technologies.find((tech) => tech.name === '.NET')
  const dotNetId = dotNetTech?.id || legacyDotNetTech?.id

  return associates.map((person) => {
    const key = `${toWhatsappNumber(person.phone)}|${person.role}`
    const canonical = canonicalAssociateByPhoneRole.get(key)
    const next = { ...person }

    if (canonical) {
      next.name = canonical.name
      next.empId = canonical.empId
    }

    if (Array.isArray(next.technologyIds) && dotNetId) {
      next.technologyIds = [...new Set(next.technologyIds.map((id) => (id === legacyDotNetTech?.id ? dotNetId : id)))]
    }

    return next
  })
}

const migrateStoredData = (parsed) => {
  const migratedTechnologies = migrateTechnologies(parsed.technologies || [])
  const migratedAssociates = migrateAssociates(parsed.associates || [], migratedTechnologies)
  return {
    ...parsed,
    version: STORAGE_VERSION,
    technologies: migratedTechnologies.length ? migratedTechnologies : seed.technologies,
    associates: migratedAssociates.length ? migratedAssociates : seed.associates,
    recipients: parsed.recipients?.length ? parsed.recipients : seed.recipients,
    gradeLevels: parsed.gradeLevels?.length ? parsed.gradeLevels : seed.gradeLevels,
    myName: parsed.myName || seed.myName,
  }
}

const getStoredData = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if ((parsed.version || 0) < STORAGE_VERSION) return migrateStoredData(parsed)
    return parsed
  } catch {
    return null
  }
}
const defaultAssociateForm = {
  name: '',
  phone: '',
  role: 'TR',
  technologyIds: [],
  grade: 'C3A',
  empId: '',
  location: '',
  notes: '',
  active: true,
}
const defaultRequirementRow = (technologyId = '') => ({ id: createId(), technologyId, count: 1 })

function App() {
  const storedData = getStoredData()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

  const [technologies, setTechnologies] = useState(storedData?.technologies || seed.technologies)
  const [associates, setAssociates] = useState(storedData?.associates || seed.associates)
  const [history, setHistory] = useState(storedData?.history || seed.history)
  const [recipients, setRecipients] = useState(storedData?.recipients || seed.recipients)
  const [gradeLevels, setGradeLevels] = useState(storedData?.gradeLevels || seed.gradeLevels)
  const [myName, setMyName] = useState(storedData?.myName || seed.myName)

  const [selectedDate, setSelectedDate] = useState(getNextDateIso())
  const [driveType, setDriveType] = useState('Virtual Drive')
  const [driveLocation, setDriveLocation] = useState('')
  const [recipient, setRecipient] = useState('Balaji')
  const [recipientInput, setRecipientInput] = useState('')
  const [requirementRows, setRequirementRows] = useState([
    defaultRequirementRow((storedData?.technologies || seed.technologies).find((tech) => tech.active)?.id || ''),
  ])
  const [assignments, setAssignments] = useState([])

  const [associateForm, setAssociateForm] = useState(defaultAssociateForm)
  const [editingAssociateId, setEditingAssociateId] = useState('')
  const [techInput, setTechInput] = useState('')
  const [historyFilters, setHistoryFilters] = useState({ date: '', driveType: 'All', technologyId: 'All' })
  const [gradeInput, setGradeInput] = useState((storedData?.gradeLevels || seed.gradeLevels).join(', '))

  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true')

  const activeTechnologies = useMemo(() => technologies.filter((item) => item.active), [technologies])
  const activeTRByTech = useMemo(() => {
    const map = {}
    for (const tech of activeTechnologies) {
      map[tech.id] = associates.filter(
        (person) =>
          person.active &&
          (person.role === 'TR' || person.role === 'BOTH') &&
          person.technologyIds.includes(tech.id),
      )
    }
    return map
  }, [associates, activeTechnologies])
  const activeMR = useMemo(
    () => associates.filter((person) => person.active && (person.role === 'MR' || person.role === 'BOTH')),
    [associates],
  )

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, technologies, associates, history, recipients, gradeLevels, myName }),
    )
  }, [technologies, associates, history, recipients, gradeLevels, myName])

  const addRecipient = () => {
    const trimmed = recipientInput.trim()
    if (!trimmed) return
    if (!recipients.includes(trimmed)) setRecipients((prev) => [...prev, trimmed])
    setRecipient(trimmed)
    setRecipientInput('')
  }

  const removeRecipient = (name) => {
    const nextRecipients = recipients.filter((item) => item !== name)
    setRecipients(nextRecipients)
    if (recipient === name) setRecipient(nextRecipients[0] || 'Balaji')
  }

  const generateAssignments = () => {
    if (driveType === 'Physical Drive' && !driveLocation) {
      alert('Please select physical drive location.')
      return
    }
    const activeIds = new Set(activeTechnologies.map((tech) => tech.id))
    const fallbackTechId = activeTechnologies[0]?.id || ''
    const rows = requirementRows
      .map((row) => ({
        ...row,
        technologyId: activeIds.has(row.technologyId) ? row.technologyId : fallbackTechId,
      }))
      .filter((row) => row.technologyId && Number(row.count) > 0)
    const next = rows
      .map((row) => {
        const baseTrPool = activeTRByTech[row.technologyId] || []
        const baseMrPool = activeMR
        const trEligible =
          driveType === 'Physical Drive'
            ? baseTrPool.filter((person) => person.location === driveLocation)
            : baseTrPool
        const mrEligible =
          driveType === 'Physical Drive'
            ? baseMrPool.filter((person) => person.location === driveLocation)
            : baseMrPool
        const trPool = sortByRecommendation(
          trEligible,
          history,
          'TR',
          row.technologyId,
          selectedDate,
        )
        const mrPool = sortByRecommendation(mrEligible, history, 'MR', row.technologyId, selectedDate)
        if (!trPool.length || !mrPool.length) return null
        return {
          id: createId(),
          technologyId: row.technologyId,
          count: Number(row.count),
          trChoices: trPool.map((p) => p.id),
          mrChoices: mrPool.map((p) => p.id),
          trId: trPool[0]?.id || '',
          mrId: mrPool[0]?.id || '',
          trStatus: 'Pending',
          mrStatus: 'Pending',
          trStart: '10:00',
          trEnd: '12:00',
          mrStart: '10:00',
          mrEnd: '12:00',
          copiedAt: '',
        }
      })
      .filter(Boolean)
    if (!next.length) {
      alert('No eligible panelists found. Check active technology, location, and associate availability.')
    }
    setAssignments(next)
  }

  const updateAssignment = (id, updates) => {
    setAssignments((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  const saveAssignment = async (assignment) => {
    const tech = technologies.find((item) => item.id === assignment.technologyId)
    const tr = associates.find((item) => item.id === assignment.trId)
    const mr = associates.find((item) => item.id === assignment.mrId)
    if (!tech || !tr || !mr) return
    if (!assignment.trStart || !assignment.trEnd || !assignment.mrStart || !assignment.mrEnd) {
      alert('Please set both TR and MR timings before saving.')
      return
    }

    const message = buildMessage({
      recipient: recipient || 'Balaji',
      date: selectedDate,
      driveType,
      driveLocation,
      technologyName: tech.name.toUpperCase(),
      count: assignment.count,
      tr,
      mr,
      trStart: assignment.trStart,
      trEnd: assignment.trEnd,
      mrStart: assignment.mrStart,
      mrEnd: assignment.mrEnd,
    })

    try {
      await navigator.clipboard.writeText(message)
    } catch {
      // ignored
    }

    const record = {
      id: createId(),
      date: selectedDate,
      driveType,
      driveLocation,
      technologyId: tech.id,
      technologyName: tech.name,
      count: assignment.count,
      trId: tr.id,
      trName: tr.name,
      trPhone: tr.phone,
      trGrade: tr.grade,
      trEmpId: tr.empId,
      trStart: assignment.trStart,
      trEnd: assignment.trEnd,
      trStatus: assignment.trStatus,
      mrId: mr.id,
      mrName: mr.name,
      mrPhone: mr.phone,
      mrGrade: mr.grade,
      mrEmpId: mr.empId,
      mrStart: assignment.mrStart,
      mrEnd: assignment.mrEnd,
      mrStatus: assignment.mrStatus,
      recipient: recipient || 'Balaji',
      message,
      createdAt: new Date().toISOString(),
    }

    setHistory((prev) => [...prev, record])
    updateAssignment(assignment.id, { copiedAt: new Date().toISOString() })
  }

  const submitAssociate = (event) => {
    event.preventDefault()
    if (!associateForm.name.trim() || !associateForm.phone.trim()) return

    const payload = {
      ...associateForm,
      name: associateForm.name.trim(),
      phone: normalizePhone(associateForm.phone),
      empId: associateForm.empId.trim(),
      location: associateForm.location,
      notes: associateForm.notes.trim(),
      technologyIds:
        associateForm.role === 'MR'
          ? []
          : associateForm.technologyIds.filter((id) => technologies.some((tech) => tech.id === id)),
    }

    if (editingAssociateId) {
      setAssociates((prev) => prev.map((item) => (item.id === editingAssociateId ? { ...item, ...payload } : item)))
    } else {
      setAssociates((prev) => [...prev, { ...payload, id: createId() }])
    }
    setAssociateForm(defaultAssociateForm)
    setEditingAssociateId('')
  }

  const editAssociate = (item) => {
    setAssociateForm({
      name: item.name,
      phone: item.phone,
      role: item.role,
      technologyIds: item.technologyIds || [],
      grade: item.grade,
      empId: item.empId || '',
      location: item.location || '',
      notes: item.notes || '',
      active: item.active,
    })
    setEditingAssociateId(item.id)
    setActiveTab('associates')
  }

  const saveGrades = () => {
    const next = gradeInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (next.length) setGradeLevels(next)
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ technologies, associates, history, recipients, gradeLevels, myName }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `boa-panel-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportAssociates = () => {
    const payload = associates.map((person) => ({
      ...person,
      technologyNames: (person.technologyIds || [])
        .map((id) => technologies.find((tech) => tech.id === id)?.name)
        .filter(Boolean),
    }))
    const blob = new Blob([JSON.stringify({ associates: payload }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `boa-associates-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importAssociatesAppend = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = JSON.parse(text)
      const incoming = Array.isArray(parsed) ? parsed : parsed.associates
      if (!Array.isArray(incoming)) {
        throw new Error('Invalid associates file')
      }

      const existingKeys = new Set(
        associates.map((person) =>
          person.empId?.trim()
            ? `emp:${person.empId.trim()}`
            : `phone:${toWhatsappNumber(person.phone)}|role:${person.role}|name:${person.name.toLowerCase().trim()}`,
        ),
      )

      const appended = []
      for (const raw of incoming) {
        const technologyNames = Array.isArray(raw.technologyNames)
          ? raw.technologyNames
          : (raw.technologyIds || [])
              .map((id) => technologies.find((tech) => tech.id === id)?.name)
              .filter(Boolean)
        const techIds = technologyNames
          .map((name) => technologies.find((tech) => tech.name.toLowerCase() === `${name}`.toLowerCase())?.id)
          .filter(Boolean)

        const normalized = {
          id: createId(),
          name: `${raw.name || ''}`.trim(),
          phone: normalizePhone(`${raw.phone || ''}`),
          role: raw.role || 'TR',
          technologyIds: raw.role === 'MR' ? [] : techIds,
          grade: raw.grade || (raw.role === 'MR' ? 'C3B' : 'C3A'),
          empId: `${raw.empId || ''}`.trim(),
          location: raw.location || '',
          active: raw.active !== false,
          notes: raw.notes || '',
        }

        if (!normalized.name || !normalized.phone) continue
        const key = normalized.empId
          ? `emp:${normalized.empId}`
          : `phone:${toWhatsappNumber(normalized.phone)}|role:${normalized.role}|name:${normalized.name.toLowerCase().trim()}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)
        appended.push(normalized)
      }

      if (appended.length) {
        setAssociates((prev) => [...prev, ...appended])
      }
      alert(`Import complete. Added ${appended.length} new associate(s).`)
    } catch {
      alert('Invalid associates file')
    }
    event.target.value = ''
  }

  const importData = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = JSON.parse(text)
      if (parsed.technologies) setTechnologies(parsed.technologies)
      if (parsed.associates) setAssociates(parsed.associates)
      if (parsed.history) setHistory(parsed.history)
      if (parsed.recipients) setRecipients(parsed.recipients)
      if (parsed.myName) setMyName(parsed.myName)
      if (parsed.gradeLevels) {
        setGradeLevels(parsed.gradeLevels)
        setGradeInput(parsed.gradeLevels.join(', '))
      }
      setAssignments([])
    } catch {
      alert('Invalid backup file')
    }
    event.target.value = ''
  }

  const filteredHistory = useMemo(
    () =>
      history.filter((item) => {
        if (historyFilters.date && item.date !== historyFilters.date) return false
        if (historyFilters.driveType !== 'All' && item.driveType !== historyFilters.driveType) return false
        if (historyFilters.technologyId !== 'All' && item.technologyId !== historyFilters.technologyId) return false
        return true
      }),
    [history, historyFilters],
  )

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FiCalendar /> },
    { id: 'associates', label: 'Associates', icon: <FiUsers /> },
    { id: 'technologies', label: 'Technologies', icon: <FiArchive /> },
    { id: 'history', label: 'History', icon: <FiClock /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings /> },
  ]

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <FiMenu />
        </button>
        <div>
          <h1>BOA Panel Navigator</h1>
          <p>Daily TR/MR scheduling with smart rest rotation</p>
        </div>
      </header>

      {menuOpen ? <div className="backdrop" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`side-menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-head">
          <strong>Sections</strong>
          <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <FiX />
          </button>
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id)
              setMenuOpen(false)
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </aside>

      <main className="content">
        {activeTab === 'dashboard' && (
          <section className="panel">
            <div className="section-title">
              <h2>Drive Request</h2>
            </div>
            <div className="grid two">
              <label>
                Date
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              </label>
              <label>
                Drive Type
                <select
                  value={driveType}
                  onChange={(e) => {
                    setDriveType(e.target.value)
                    if (e.target.value === 'Virtual Drive') setDriveLocation('')
                  }}
                >
                  {DRIVE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {driveType === 'Physical Drive' && (
              <label>
                Physical Drive Location
                <select value={driveLocation} onChange={(e) => setDriveLocation(e.target.value)}>
                  <option value="">Select location</option>
                  {PHYSICAL_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="recipient-row">
              <label>
                Greeting Name
                <select value={recipients.includes(recipient) ? recipient : recipients[0] || ''} onChange={(e) => setRecipient(e.target.value)}>
                  {recipients.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Add Greeting Name
                <input
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="Type and Save"
                />
              </label>
              <button className="btn ghost" onClick={addRecipient}>
                <FiSave /> Save Name
              </button>
            </div>

            <div className="section-title compact">
              <h3>Technology-Wise Count</h3>
              <button
                className="btn ghost"
                onClick={() =>
                  setRequirementRows((prev) => [...prev, defaultRequirementRow(activeTechnologies[0]?.id || '')])
                }
              >
                <FiPlus /> Add Row
              </button>
            </div>

            <div className="stack">
              {requirementRows.map((row) => (
                <div key={row.id} className="requirement-row">
                  <select
                    value={activeTechnologies.some((tech) => tech.id === row.technologyId) ? row.technologyId : ''}
                    onChange={(e) =>
                      setRequirementRows((prev) =>
                        prev.map((item) => (item.id === row.id ? { ...item, technologyId: e.target.value } : item)),
                      )
                    }
                  >
                    <option value="">Select Technology</option>
                    {activeTechnologies.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={row.count}
                    onChange={(e) =>
                      setRequirementRows((prev) =>
                        prev.map((item) => (item.id === row.id ? { ...item, count: Number(e.target.value || 0) } : item)),
                      )
                    }
                  />
                  <button
                    className="icon-btn danger"
                    onClick={() => setRequirementRows((prev) => prev.filter((item) => item.id !== row.id))}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>

            <button className="btn primary" onClick={generateAssignments}>
              <FiShare2 /> Suggest Panelists
            </button>

            <div className="stack assignments">
              {assignments.map((assignment) => {
                const tech = technologies.find((item) => item.id === assignment.technologyId)
                const tr = associates.find((item) => item.id === assignment.trId)
                const mr = associates.find((item) => item.id === assignment.mrId)
                if (!tech || !tr || !mr) return null

                return (
                  <article className="assignment-card" key={assignment.id}>
                    <div className="section-title compact">
                      <h3>
                        {tech.name} ({assignment.count})
                      </h3>
                      {assignment.copiedAt ? <span className="badge">Saved</span> : <span className="badge muted">Draft</span>}
                    </div>

                    <div className="person-card">
                      <div className="row-head">
                        <strong>TR Panelist</strong>
                        <select value={assignment.trId} onChange={(e) => updateAssignment(assignment.id, { trId: e.target.value })}>
                          {assignment.trChoices.map((id) => {
                            const person = associates.find((item) => item.id === id)
                            if (!person) return null
                            return (
                              <option key={id} value={id}>
                                {person.name} - {tech.name} TR
                              </option>
                            )
                          })}
                        </select>
                      </div>
                      <p>{tr.phone}</p>
                      <div className="actions-row">
                        <a className="icon-link" href={`tel:${tr.phone}`} aria-label="Call TR">
                          <FiPhone />
                        </a>
                        <a
                          className="icon-link whatsapp"
                          href={getWhatsappChatUrl(tr.phone)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp TR Chat"
                        >
                          <FaWhatsapp />
                        </a>
                        <a
                          className="icon-link whatsapp"
                          href={getWhatsappCallUrl(tr.phone)}
                          aria-label="WhatsApp TR Call"
                        >
                          <FiPhone />
                        </a>
                        <select value={assignment.trStatus} onChange={(e) => updateAssignment(assignment.id, { trStatus: e.target.value })}>
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <a
                          className={`icon-link whatsapp force-msg-btn ${assignment.trStatus === 'Force Assign' ? '' : 'disabled'}`}
                          href={getWhatsappChatUrl(
                            tr.phone,
                            buildForceAssignMessage({
                              associateName: tr.name,
                              myName: myName || 'Niladri Ghoshal',
                              date: selectedDate,
                              driveType,
                              location: driveLocation,
                              technologyName: tech.name,
                              role: 'TR',
                              start: normalizeTimeSlot(assignment.trStart),
                              end: normalizeTimeSlot(assignment.trEnd, addTwoHours(normalizeTimeSlot(assignment.trStart))),
                            }),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp TR Prefilled Message"
                          title="Set status to Force Assign to enable prefilled message"
                        >
                          <FiCopy />
                        </a>
                      </div>
                      <div className="time-grid">
                        <label>
                          Start
                          <TimeSlotPicker
                            value={assignment.trStart}
                            onChange={(nextStart) =>
                              updateAssignment(assignment.id, {
                                trStart: normalizeTimeSlot(nextStart),
                                trEnd: normalizeTimeSlot(
                                  assignment.trEnd,
                                  addTwoHours(normalizeTimeSlot(nextStart)),
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          End
                          <TimeSlotPicker
                            value={assignment.trEnd}
                            onChange={(nextEnd) =>
                              updateAssignment(assignment.id, {
                                trEnd: normalizeTimeSlot(nextEnd, assignment.trEnd),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="person-card">
                      <div className="row-head">
                        <strong>MR Panelist</strong>
                        <select value={assignment.mrId} onChange={(e) => updateAssignment(assignment.id, { mrId: e.target.value })}>
                          {assignment.mrChoices.map((id) => {
                            const person = associates.find((item) => item.id === id)
                            if (!person) return null
                            return (
                              <option key={id} value={id}>
                                {person.name} - MR
                              </option>
                            )
                          })}
                        </select>
                      </div>
                      <p>{mr.phone}</p>
                      <div className="actions-row">
                        <a className="icon-link" href={`tel:${mr.phone}`} aria-label="Call MR">
                          <FiPhone />
                        </a>
                        <a
                          className="icon-link whatsapp"
                          href={getWhatsappChatUrl(mr.phone)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp MR Chat"
                        >
                          <FaWhatsapp />
                        </a>
                        <a
                          className="icon-link whatsapp"
                          href={getWhatsappCallUrl(mr.phone)}
                          aria-label="WhatsApp MR Call"
                        >
                          <FiPhone />
                        </a>
                        <select value={assignment.mrStatus} onChange={(e) => updateAssignment(assignment.id, { mrStatus: e.target.value })}>
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <a
                          className={`icon-link whatsapp force-msg-btn ${assignment.mrStatus === 'Force Assign' ? '' : 'disabled'}`}
                          href={getWhatsappChatUrl(
                            mr.phone,
                            buildForceAssignMessage({
                              associateName: mr.name,
                              myName: myName || 'Niladri Ghoshal',
                              date: selectedDate,
                              driveType,
                              location: driveLocation,
                              technologyName: tech.name,
                              role: 'MR',
                              start: normalizeTimeSlot(assignment.mrStart),
                              end: normalizeTimeSlot(assignment.mrEnd, addTwoHours(normalizeTimeSlot(assignment.mrStart))),
                            }),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="WhatsApp MR Prefilled Message"
                          title="Set status to Force Assign to enable prefilled message"
                        >
                          <FiCopy />
                        </a>
                      </div>
                      <div className="time-grid">
                        <label>
                          Start
                          <TimeSlotPicker
                            value={assignment.mrStart}
                            onChange={(nextStart) =>
                              updateAssignment(assignment.id, {
                                mrStart: normalizeTimeSlot(nextStart),
                                mrEnd: normalizeTimeSlot(
                                  assignment.mrEnd,
                                  addTwoHours(normalizeTimeSlot(nextStart)),
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          End
                          <TimeSlotPicker
                            value={assignment.mrEnd}
                            onChange={(nextEnd) =>
                              updateAssignment(assignment.id, {
                                mrEnd: normalizeTimeSlot(nextEnd, assignment.mrEnd),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <button className="btn primary" onClick={() => saveAssignment(assignment)}>
                      <FiCopy /> Copy Message + Save History
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'associates' && (
          <section className="panel">
            <div className="section-title">
              <h2>Associates</h2>
              <div className="actions-row">
                <button className="btn ghost" type="button" onClick={exportAssociates}>
                  <FiDownload /> Export Associates
                </button>
                <label className="btn ghost file-upload">
                  <FiUpload /> Import Associates
                  <input type="file" accept="application/json" onChange={importAssociatesAppend} />
                </label>
              </div>
            </div>

            <form className="stack" onSubmit={submitAssociate}>
              <div className="grid two">
                <label>
                  Name
                  <input
                    list="employee-directory-names"
                    value={associateForm.name}
                    onChange={(e) => {
                      const matched = findDirectoryByName(e.target.value)
                      setAssociateForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                        empId: matched ? matched.empId : prev.empId,
                      }))
                    }}
                    required
                  />
                </label>
                <label>
                  Phone
                  <input value={associateForm.phone} onChange={(e) => setAssociateForm((prev) => ({ ...prev, phone: e.target.value }))} required />
                </label>
              </div>

              <div className="grid two">
                <label>
                  Role
                  <select
                    value={associateForm.role}
                    onChange={(e) =>
                      setAssociateForm((prev) => ({ ...prev, role: e.target.value, grade: e.target.value === 'MR' ? 'C3B' : prev.grade }))
                    }
                  >
                    <option value="TR">TR</option>
                    <option value="MR">MR</option>
                    <option value="BOTH">Both</option>
                  </select>
                </label>
                <label>
                  Grade
                  <select value={associateForm.grade} onChange={(e) => setAssociateForm((prev) => ({ ...prev, grade: e.target.value }))}>
                    {gradeLevels.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {(associateForm.role === 'TR' || associateForm.role === 'BOTH') && (
                <label>
                  Technologies (TR)
                  <div className="chip-wrap">
                    {activeTechnologies.map((tech) => (
                      <button
                        key={tech.id}
                        type="button"
                        className={`chip ${associateForm.technologyIds.includes(tech.id) ? 'active' : ''}`}
                        onClick={() =>
                          setAssociateForm((prev) => ({
                            ...prev,
                            technologyIds: prev.technologyIds.includes(tech.id)
                              ? prev.technologyIds.filter((id) => id !== tech.id)
                              : [...prev.technologyIds, tech.id],
                          }))
                        }
                      >
                        {tech.name}
                      </button>
                    ))}
                  </div>
                </label>
              )}

              <div className="grid three">
                <label>
                  Employee ID
                  <input
                    value={associateForm.empId}
                    onChange={(e) => {
                      const matched = findDirectoryByEmpId(e.target.value)
                      setAssociateForm((prev) => ({
                        ...prev,
                        empId: e.target.value,
                        name: matched ? matched.name : prev.name,
                      }))
                    }}
                    placeholder="Add later"
                  />
                </label>
                <datalist id="employee-directory-names">
                  {EMPLOYEE_DIRECTORY.map((entry) => (
                    <option key={entry.empId} value={entry.name} />
                  ))}
                </datalist>
                <label>
                  Location
                  <select
                    value={associateForm.location}
                    onChange={(e) => setAssociateForm((prev) => ({ ...prev, location: e.target.value }))}
                  >
                    <option value="">Not Set</option>
                    {PHYSICAL_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notes
                  <input value={associateForm.notes} onChange={(e) => setAssociateForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </label>
              </div>

              <div className="actions-row">
                <button className="btn primary" type="submit">
                  <FiSave /> {editingAssociateId ? 'Update Associate' : 'Add Associate'}
                </button>
                {editingAssociateId && (
                  <button className="btn ghost" type="button" onClick={() => { setAssociateForm(defaultAssociateForm); setEditingAssociateId('') }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            <div className="stack">
              {associates.map((person) => {
                const techNames = person.technologyIds
                  .map((id) => technologies.find((tech) => tech.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')
                return (
                  <article className="list-card" key={person.id}>
                    <div>
                      <strong>{person.name}</strong>
                      <p>
                        {person.role}
                        {techNames ? ` | ${techNames}` : ''}
                      </p>
                      <p>
                        {person.phone} | {person.grade} | {person.empId || 'Emp ID pending'}
                        {person.location ? ` | ${person.location}` : ''}
                      </p>
                    </div>
                    <div className="actions-row">
                      <button className="icon-btn" onClick={() => editAssociate(person)}>
                        <FiEdit2 />
                      </button>
                      <button className="icon-btn" onClick={() => setAssociates((prev) => prev.map((item) => (item.id === person.id ? { ...item, active: !item.active } : item)))}>
                        {person.active ? <FiX /> : <FiCheck />}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'technologies' && (
          <section className="panel">
            <div className="section-title">
              <h2>Technologies</h2>
            </div>
            <div className="recipient-row">
              <input placeholder="Add new technology" value={techInput} onChange={(e) => setTechInput(e.target.value)} />
              <button
                className="btn primary"
                onClick={() => {
                  const name = techInput.trim()
                  if (!name) return
                  if (technologies.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
                  setTechnologies((prev) => [...prev, { id: createId(), name, active: true }])
                  setTechInput('')
                }}
              >
                <FiPlus /> Add
              </button>
            </div>
            <div className="stack">
              {technologies.map((tech) => (
                <article className="list-card" key={tech.id}>
                  <strong>{tech.name}</strong>
                  <button className="btn ghost" onClick={() => setTechnologies((prev) => prev.map((item) => (item.id === tech.id ? { ...item, active: !item.active } : item)))}>
                    {tech.active ? 'Deactivate' : 'Activate'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="panel">
            <div className="section-title">
              <h2>History</h2>
            </div>
            <div className="grid three">
              <label>
                <FiFilter /> Date
                <input type="date" value={historyFilters.date} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, date: e.target.value }))} />
              </label>
              <label>
                Drive Type
                <select value={historyFilters.driveType} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, driveType: e.target.value }))}>
                  <option value="All">All</option>
                  {DRIVE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Skill
                <select value={historyFilters.technologyId} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, technologyId: e.target.value }))}>
                  <option value="All">All</option>
                  {technologies.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="stack">
              {filteredHistory
                .slice()
                .reverse()
                .map((item) => (
                  <article className="history-card" key={item.id}>
                    <div className="section-title compact">
                      <h3>
                        {item.technologyName} | {item.count} interviews
                      </h3>
                      <span>{formatDisplayDate(item.date)}</span>
                    </div>
                    <p>Recipient: {item.recipient}</p>
                    <p>
                      Drive: {item.driveType}
                      {item.driveType === 'Physical Drive' && item.driveLocation ? ` (${item.driveLocation})` : ''}
                    </p>
                    <p>TR: {item.trName} ({fmtTime(item.trStart)} - {fmtTime(item.trEnd)})</p>
                    <p>MR: {item.mrName} ({fmtTime(item.mrStart)} - {fmtTime(item.mrEnd)})</p>
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(item.message)
                        } catch {
                          // ignored
                        }
                      }}
                    >
                      <FiCopy /> Copy Message
                    </button>
                  </article>
                ))}
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="panel">
            <div className="section-title">
              <h2>Settings & Backup</h2>
            </div>
            <label>
              My Name (for Force Assign WhatsApp message)
              <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Niladri Ghoshal" />
            </label>
            <label>
              Grade Levels (comma separated, in order)
              <textarea rows="3" value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} />
            </label>
            <button className="btn ghost" onClick={saveGrades}>
              <FiSave /> Save Grades
            </button>

            <div className="section-title compact">
              <h3>Remembered Greeting Names</h3>
            </div>
            <div className="chip-wrap">
              {recipients.map((name) => (
                <span className="chip active" key={name}>
                  {name}
                  <button type="button" onClick={() => removeRecipient(name)}>
                    <FiX />
                  </button>
                </span>
              ))}
            </div>

            <div className="actions-row">
              <button className="btn primary" onClick={exportData}>
                <FiDownload /> Export Backup
              </button>
              <label className="btn ghost file-upload">
                <FiUpload /> Import Backup
                <input type="file" accept="application/json" onChange={importData} />
              </label>
            </div>

            <div className="creator-credit">
              <p>Created and maintained by Niladri Ghoshal.</p>
              <a href="https://github.com/niladrighoshal" target="_blank" rel="noreferrer">
                <FaGithub /> github.com/niladrighoshal
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
