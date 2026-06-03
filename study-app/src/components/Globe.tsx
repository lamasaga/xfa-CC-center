import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ParticleData {
  position: THREE.Vector3;
  color: string;
  name: string;
  nameEn: string;
  ranking: number;
}

const REGION_COLORS: Record<string, string> = {
  us: '#3B6EA5',
  uk: '#8B2332',
  canada: '#C2553A',
  australia: '#4A7C6F',
  europe: '#6B4C8A',
  'hong-kong': '#C8553D',
  singapore: '#D4943A',
  art: '#C8A45C',
};

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

interface GlobeSceneProps {
  universities: Array<{
    name: string;
    name_en: string;
    region: string;
    city?: string;
    ranking: { qs?: number };
    location?: { lat?: number; lng?: number };
  }>;
}

function WireframeSphere() {
  return (
    <mesh>
      <sphereGeometry args={[3, 32, 32]} />
      <meshBasicMaterial color="#C8A45C" wireframe transparent opacity={0.25} />
    </mesh>
  );
}

function AmbientParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 150;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      vel[i * 3] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useEffect(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, [positions]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr || !posAttr.array) return;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3];
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2];
      const dist = Math.sqrt(arr[i * 3] ** 2 + arr[i * 3 + 1] ** 2 + arr[i * 3 + 2] ** 2);
      if (dist < 3.5 || dist > 8) {
        velocities[i * 3] *= -1;
        velocities[i * 3 + 1] *= -1;
        velocities[i * 3 + 2] *= -1;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry />
      <pointsMaterial color="#6B6560" size={0.03} transparent opacity={0.25} sizeAttenuation />
    </points>
  );
}

function UniversityParticles({ universities }: { universities: GlobeSceneProps['universities'] }) {
  const pointsRef = useRef<THREE.Points>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { camera, pointer } = useThree();

  const particles = useMemo<ParticleData[]>(() => {
    const knownLocs: Record<string, [number, number]> = {
      'Boston': [42.3601, -71.0589],
      'Cambridge': [52.2053, 0.1218],
      'Cambridge MA': [42.3736, -71.1097],
      'Stanford': [37.4241, -122.1661],
      'New York': [40.7128, -74.006],
      'Pasadena': [34.1478, -118.1445],
      'Berkeley': [37.8719, -122.2585],
      'Oxford': [51.7548, -1.2544],
      'London': [51.5074, -0.1278],
      'Princeton': [40.3573, -74.6672],
      'New Haven': [41.3163, -72.9223],
      'Philadelphia': [39.9522, -75.1638],
      'Ithaca': [42.443, -76.5018],
      'Chicago': [41.8781, -87.6298],
      'Baltimore': [39.3299, -76.6205],
      'Evanston': [42.0451, -87.6877],
      'Notre Dame': [41.7056, -86.2353],
      'Durham': [36.0014, -78.9382],
      'Hanover': [43.7044, -72.2887],
      'Providence': [41.824, -71.4128],
      'Nashville': [36.1447, -86.8027],
      'Atlanta': [33.749, -84.388],
      'Ann Arbor': [42.2808, -83.743],
      'Washington': [38.9072, -77.0369],
      'Los Angeles': [34.0522, -118.2437],
      'San Diego': [32.7157, -117.1611],
      'Montreal': [45.5017, -73.5673],
      'Toronto': [43.6532, -79.3832],
      'Vancouver': [49.2827, -123.1207],
      'Sydney': [-33.8688, 151.2093],
      'Melbourne': [-37.8136, 144.9631],
      'Canberra': [-35.2809, 149.13],
      'Brisbane': [-27.4698, 153.0251],
      'Perth': [-31.9505, 115.8605],
      'Adelaide': [-34.9285, 138.6007],
      'Zurich': [47.3769, 8.5417],
      'Munich': [48.1351, 11.582],
      'Paris': [48.8566, 2.3522],
      'Milan': [45.4642, 9.19],
      'Delft': [52.0116, 4.3571],
      'Hong Kong': [22.3193, 114.1694],
      'Singapore': [1.3521, 103.8198],
    };

    return universities
      .map((u) => {
        let lat: number, lng: number;
        const loc = u.location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          lat = loc.lat;
          lng = loc.lng;
        } else {
          const cityName = (u.city || '').split(',')[0].trim();
          const known = knownLocs[cityName];
          if (!known) return null;
          lat = known[0];
          lng = known[1];
        }
        return {
          position: latLngToVector3(lat, lng, 3.05),
          color: REGION_COLORS[u.region] || '#C8A45C',
          name: u.name,
          nameEn: u.name_en,
          ranking: u.ranking?.qs || 999,
        };
      })
      .filter((p): p is ParticleData => p !== null);
  }, [universities]);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(particles.length * 3);
    const col = new Float32Array(particles.length * 3);
    particles.forEach((p, i) => {
      pos[i * 3] = p.position.x;
      pos[i * 3 + 1] = p.position.y;
      pos[i * 3 + 2] = p.position.z;
      const c = new THREE.Color(p.color);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    return { positions: pos, colors: col };
  }, [particles]);

  useEffect(() => {
    if (!pointsRef.current || particles.length === 0) return;
    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(particles.length).fill(0.08), 1));
  }, [particles, positions, colors]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || particles.length === 0) return;
    const sizesAttr = pointsRef.current.geometry.attributes.size;
    if (!sizesAttr || !sizesAttr.array) return;

    const t = clock.getElapsedTime();
    const sizes = sizesAttr.array as Float32Array;

    for (let i = 0; i < particles.length; i++) {
      const baseSize = 0.08;
      const pulse = 1 + 0.2 * Math.sin(t * 2 + i * 0.1);
      const targetSize = i === hoveredIdx ? 0.18 : baseSize * pulse;
      sizes[i] += (targetSize - sizes[i]) * 0.1;
    }
    sizesAttr.needsUpdate = true;

    // Raycasting for hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(pointer.x, pointer.y);
    raycaster.setFromCamera(mouse, camera);
    const pointPositions = particles.map((p) => p.position);
    let closestIdx: number | null = null;
    let closestDist = Infinity;
    for (let i = 0; i < pointPositions.length; i++) {
      const dist = raycaster.ray.distanceToPoint(pointPositions[i]);
      if (dist < 0.15 && dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoveredIdx(closestIdx);
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry />
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.85} sizeAttenuation />
      </points>

      {hoveredIdx !== null && particles[hoveredIdx] && (
        <HtmlTooltip
          position={particles[hoveredIdx].position}
          name={particles[hoveredIdx].name}
          nameEn={particles[hoveredIdx].nameEn}
          ranking={particles[hoveredIdx].ranking}
        />
      )}
    </>
  );
}

function HtmlTooltip({
  position,
  name,
  nameEn,
  ranking,
}: {
  position: THREE.Vector3;
  name: string;
  nameEn: string;
  ranking: number;
}) {
  const vec = new THREE.Vector3(position.x, position.y, position.z);
  vec.multiplyScalar(1.15);

  return (
    <group position={vec}>
      <Html center>
        <div
          className="pointer-events-none whitespace-nowrap rounded-lg px-3 py-2"
          style={{
            backgroundColor: '#F5F0E8',
            border: '1px solid #C8A45C',
            color: '#2C2420',
            fontSize: 13,
            fontFamily: '"Noto Sans SC", sans-serif',
            boxShadow: '0 4px 20px rgba(44, 36, 32, 0.06)',
          }}
        >
          <div className="font-medium">{name}</div>
          <div style={{ color: '#6B6560', fontSize: 11 }}>{nameEn}</div>
          {ranking < 999 && (
            <div style={{ color: '#C8A45C', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
              QS #{ranking}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function GlobeGroup({ universities }: GlobeSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <WireframeSphere />
      <UniversityParticles universities={universities} />
      <AmbientParticles />
    </group>
  );
}

interface GlobeProps {
  universities: Array<{
    name: string;
    name_en: string;
    region: string;
    city?: string;
    ranking: { qs?: number };
    location?: { lat?: number; lng?: number };
  }>;
}

export default function Globe({ universities }: GlobeProps) {
  return (
    <div className="absolute inset-0" style={{ zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        style={{ background: 'radial-gradient(circle at center, #FFFFFF 0%, #FAF7F2 100%)' }}
        gl={{ antialias: true, alpha: false }}
      >
        <ambientLight intensity={0.5} />
        <GlobeGroup universities={universities} />
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} dampingFactor={0.05} enableDamping />
      </Canvas>
    </div>
  );
}
