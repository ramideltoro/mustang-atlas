import path from 'node:path';
import {openDb} from '../server/db.mjs';
import {createLearningContextCatalog} from '../server/learning-context.mjs';

const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const db=openDb({dataDir:path.resolve(option('--data','data')),readOnly:true});
try{
  const catalog=createLearningContextCatalog(db,{contentDir:path.resolve(option('--content','content'))});
  const report=catalog.report();
  console.log(JSON.stringify(report,null,2));
  if(report.missingDocumentIds.length||report.errors.length)process.exitCode=1;
}finally{db.close();}
