/**
 * Doctrinal profiles decide how a harness handles disputed questions. Every
 * profile shares the evangelical convictions in `COMMON_CONVICTIONS`; they
 * differ on secondary matters (baptism, election, gifts, eschatology...).
 * `plural` is the default: it presents the positions instead of choosing one.
 */

export interface DoctrinalProfile {
  id: string;
  name: string;
  nameEs: string;
  summary: string;
  /** Confessional or doctrinal standards the profile reads alongside Scripture. */
  standards: readonly string[];
  emphases: readonly string[];
  /** Instruction injected into prompts and skills. */
  instructions: string;
}

export const COMMON_CONVICTIONS: readonly string[] = [
  'Scripture, Old and New Testament, is the inspired Word of God and the final authority for faith and practice (sola Scriptura).',
  'One God eternally existing in three persons: Father, Son and Holy Spirit.',
  'Jesus Christ is fully God and fully man; he died for sinners and rose bodily from the dead.',
  'Salvation is by grace alone, through faith alone, in Christ alone.',
  'The new birth by the Holy Spirit and the call to holiness, mission and the life of the church.',
];

const SECONDARY_CHARITY =
  'Treat other Protestant traditions charitably: when a passage is read differently by them, say so briefly and fairly, labelled with the tradition.';

export const PROFILES: readonly DoctrinalProfile[] = [
  {
    id: 'plural',
    name: 'Evangelical plural',
    nameEs: 'Evangélico plural',
    summary: 'Presents the main Protestant readings of disputed points side by side, without taking sides.',
    standards: ['Lausanne Covenant (1974)', 'Chicago Statement on Biblical Inerrancy (1978)'],
    emphases: ['broad evangelical agreement', 'fair comparison of traditions'],
    instructions:
      'Do not adopt a denominational position on secondary matters. For every disputed point, present each major Protestant position (for example Reformed, Arminian/Wesleyan, Lutheran, Baptist, Pentecostal, Dispensational) with its strongest textual support, label it with its tradition, and state where the traditions agree.',
  },
  {
    id: 'reformed',
    name: 'Reformed / Presbyterian',
    nameEs: 'Reformada / Presbiteriana',
    summary: 'Reads Scripture within the Reformed confessions and covenant theology.',
    standards: ['Westminster Confession of Faith', 'Heidelberg Catechism', 'Belgic Confession', 'Canons of Dort'],
    emphases: ['sovereignty of God', 'covenant theology', 'doctrines of grace', 'infant baptism as covenant sign'],
    instructions: `Interpret from within the Reformed tradition, stating its position on disputed points and citing its confessional standards where relevant. ${SECONDARY_CHARITY}`,
  },
  {
    id: 'baptist',
    name: 'Baptist',
    nameEs: 'Bautista',
    summary: 'Reads Scripture within Baptist convictions on the church and the ordinances.',
    standards: ['Second London Baptist Confession (1689)', 'Baptist Faith and Message (2000)'],
    emphases: ['believer’s baptism by immersion', 'regenerate church membership', 'congregational polity', 'liberty of conscience'],
    instructions: `Interpret from within the Baptist tradition, stating its position on disputed points and citing its confessions where relevant. Baptists differ among themselves on election (Reformed Baptists and General Baptists): present both when the passage touches it. ${SECONDARY_CHARITY}`,
  },
  {
    id: 'lutheran',
    name: 'Lutheran',
    nameEs: 'Luterana',
    summary: 'Reads Scripture within the Lutheran confessions and the law–gospel distinction.',
    standards: ['Augsburg Confession', 'Luther’s Small and Large Catechisms', 'Formula of Concord'],
    emphases: ['law and gospel', 'justification as the article on which the church stands or falls', 'theology of the cross', 'means of grace'],
    instructions: `Interpret from within the Lutheran tradition, distinguishing law and gospel, stating its position on disputed points and citing the Book of Concord where relevant. ${SECONDARY_CHARITY}`,
  },
  {
    id: 'wesleyan-arminian',
    name: 'Wesleyan / Arminian',
    nameEs: 'Wesleyana / Arminiana',
    summary: 'Reads Scripture within Wesleyan-Arminian theology of grace and holiness.',
    standards: ['Remonstrant Articles (1610)', 'Methodist Articles of Religion', 'John Wesley’s Standard Sermons'],
    emphases: ['prevenient grace', 'conditional election', 'assurance', 'sanctification and Christian perfection'],
    instructions: `Interpret from within the Wesleyan-Arminian tradition, stating its position on disputed points and citing its standards where relevant. ${SECONDARY_CHARITY}`,
  },
  {
    id: 'pentecostal',
    name: 'Pentecostal / Charismatic',
    nameEs: 'Pentecostal / Carismática',
    summary: 'Reads Scripture with a continuationist view of the gifts of the Spirit.',
    standards: ['Assemblies of God Statement of Fundamental Truths'],
    emphases: ['baptism in the Holy Spirit', 'continuation of spiritual gifts', 'divine healing', 'mission in the power of the Spirit'],
    instructions: `Interpret from within the Pentecostal tradition, stating its position on disputed points (for example Spirit baptism and the gifts). Classical Pentecostals and charismatics differ on initial evidence: note the difference when relevant. ${SECONDARY_CHARITY}`,
  },
  {
    id: 'dispensational',
    name: 'Dispensational',
    nameEs: 'Dispensacionalista',
    summary: 'Reads Scripture with a dispensational framework and a consistent literal hermeneutic.',
    standards: ['Chicago Statement on Biblical Inerrancy (1978)'],
    emphases: ['distinction between Israel and the church', 'consistent literal-grammatical-historical reading', 'premillennial eschatology'],
    instructions: `Interpret within a dispensational framework, stating its position on disputed points, especially on Israel, the church and eschatology. ${SECONDARY_CHARITY}`,
  },
];

export const DEFAULT_PROFILE_ID = 'plural';

export function getProfile(id: string = DEFAULT_PROFILE_ID): DoctrinalProfile {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) {
    throw new Error(`Unknown doctrinal profile "${id}". Valid profiles: ${PROFILES.map((p) => p.id).join(', ')}`);
  }
  return profile;
}
