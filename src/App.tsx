import sections from './data/sections.json';
import { DesignSection, type SectionData } from './components/DesignSection';
import { CookieBanner } from './components/CookieBanner';

export function HomePage({basePath='./'}:{basePath?:string}) {
  const all=sections as unknown as SectionData[];
  return <>
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    <DesignSection section={all[0]} basePath={basePath}/>
    <main id="main-content" className="site-content">{all.slice(1,-1).map(section=><DesignSection key={section.id} section={section} basePath={basePath}/>)}</main>
    <DesignSection section={all[all.length-1]} basePath={basePath}/>
    <div id="cookie-root"><CookieBanner/></div>
    <div id="ui-root"/>
  </>;
}
