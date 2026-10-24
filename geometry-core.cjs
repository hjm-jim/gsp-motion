"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const TWO_PI = Math.PI * 2;

const TYPE_MAP = new Map([
  [0,  { name: "Point", label: "自由点", semanticType: 0, storageClass: 1, fileSubtype: 4, runtimeSubtype: 4, constructionCode: 0 }],
  [1,  { name: "Midpoint", label: "中点", semanticType: 1, storageClass: 1, fileSubtype: 11, runtimeSubtype: 11, constructionCode: 1 }],
  [2,  { name: "Segment", label: "线段", semanticType: 2, storageClass: 2, fileSubtype: 14, runtimeSubtype: 14, constructionCode: 4 }],
  [3,  { name: "Circle", label: "圆", semanticType: 3, storageClass: 3, fileSubtype: 28, runtimeSubtype: 22, constructionCode: 1 }],
  [5,  { name: "PerpendicularLine", label: "垂线", semanticType: 5, storageClass: 2, fileSubtype: 47, runtimeSubtype: 42, constructionCode: 1 }],
  [6,  { name: "ParallelLine", label: "平行线", semanticType: 6, storageClass: 2, fileSubtype: 46, runtimeSubtype: 41, constructionCode: 1 }],
  [7,  { name: "AngleBisector", label: "角平分线", semanticType: 7, storageClass: 2, fileSubtype: 44, runtimeSubtype: 39, constructionCode: 1 }],
  [9,  { name: "IntersectionPoint", label: "直线交点", semanticType: 9, storageClass: 1, fileSubtype: 45, runtimeSubtype: 40, constructionCode: 5 }],
  [11, { name: "LineCircleIntersection", label: "直线/圆交点", semanticType: 11, storageClass: 1, fileSubtype: 45, runtimeSubtype: 40, constructionCode: 6, branch: 1 }],
  [12, { name: "LineCircleIntersection", label: "直线/圆交点", semanticType: 12, storageClass: 1, fileSubtype: 45, runtimeSubtype: 40, constructionCode: 6, branch: -1 }],
  [13, { name: "CircleCircleIntersection", label: "圆/圆交点", semanticType: 13, storageClass: 1, fileSubtype: 45, runtimeSubtype: 40, constructionCode: 7, branch: 1 }],
  [14, { name: "CircleCircleIntersection", label: "圆/圆交点", semanticType: 14, storageClass: 1, fileSubtype: 45, runtimeSubtype: 40, constructionCode: 7, branch: -1 }],
  [15, { name: "PointOnObject", label: "对象上的点", semanticType: 15, storageClass: 1, fileSubtype: 10, runtimeSubtype: 10, constructionCode: 0 }],
  [63, { name: "Line", label: "直线", semanticType: 71, storageClass: 2, fileSubtype: 12, runtimeSubtype: 12, constructionCode: 4 }],
  [64, { name: "Ray", label: "射线", semanticType: 72, storageClass: 2, fileSubtype: 13, runtimeSubtype: 13, constructionCode: 1 }],
  [81, { name: "ArcThroughThreePoints", label: "三点弧", semanticType: 93, storageClass: 12, fileSubtype: 67, runtimeSubtype: 24, constructionCode: 1 }],
]);

const RUNTIME_SUBTYPE_BY_FILE_SUBTYPE = new Map([
  [4, 4],
  [12, 12],
  [13, 13],
  [14, 14],
  [28, 22],
]);

function reflectedGeometryInfo(storageClass, fileSubtype) {
  if (storageClass === 1) return { name: "Point", label: "对称点" };
  if (storageClass === 2) {
    return {
      name: new Map([[12, "Line"], [13, "Ray"], [14, "Segment"]]).get(fileSubtype) ?? "Line",
      label: new Map([[12, "对称直线"], [13, "对称射线"], [14, "对称线段"]]).get(fileSubtype) ?? "对称直线型对象",
    };
  }
  if (storageClass === 3) return { name: "Circle", label: "对称圆" };
  return { name: "Reflection", label: "对称对象" };
}

const POINT_TYPES = new Set(["Point", "Midpoint", "IntersectionPoint", "LineCircleIntersection", "CircleCircleIntersection", "PointOnObject"]);
const LINE_TYPES = new Set(["Segment", "Line", "Ray", "PerpendicularLine", "ParallelLine", "AngleBisector"]);
const INFINITE_LINE_TYPES = new Set(["Line", "PerpendicularLine", "ParallelLine", "AngleBisector"]);
const CURVE_TYPES = new Set(["Circle", "ArcThroughThreePoints"]);

const TYPE_COLORS = {
  Segment: "#435069",
  Line: "#435069",
  Ray: "#0f8b83",
  PerpendicularLine: "#d74b4b",
  ParallelLine: "#178b69",
  AngleBisector: "#7c4ce0",
  Circle: "#3478e5",
  ArcThroughThreePoints: "#e96932",
  Point: "#3478e5",
  constructedPoint: "#7c4ce0",
};

function readAscii(bytes) {
  return new TextDecoder("ascii").decode(bytes);
}

function readUtf16Le(bytes) {
  return new TextDecoder("utf-16le").decode(bytes);
}

function parseRecords(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = [];
  let offset = 4;
  while (offset + 8 <= bytes.byteLength) {
    const payloadLength = view.getUint32(offset, true);
    const tag = view.getUint32(offset + 4, true);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > bytes.byteLength) {
      throw new Error(`记录 0x${offset.toString(16)} 超出文件边界`);
    }
    records.push({
      offset,
      tag,
      payload: bytes.slice(payloadStart, payloadEnd),
    });
    offset = payloadStart + ((payloadLength + 1) & ~1);
  }
  if (offset !== bytes.byteLength) {
    throw new Error(`文件尾部存在 ${bytes.byteLength - offset} 个无法解析的字节`);
  }
  return records;
}

function decodeLabel(payload) {
  if (payload.byteLength < 24) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const count = view.getUint16(22, true);
  const end = 24 + count;
  if (!count || end > payload.byteLength) return null;
  const bytes = payload.slice(24, end);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}

function decodeObject(index, records) {
  const headerRecord = records[0];
  const payload = headerRecord.payload;
  if (payload.byteLength < 12) {
    throw new Error(`对象 ${index} 的 tag 2000 头过短`);
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const headerU16 = [];
  for (let offset = 0; offset + 1 < payload.byteLength; offset += 2) {
    headerU16.push(view.getUint16(offset, true));
  }
  const fileType = headerU16[0];
  let mapped = TYPE_MAP.get(fileType);
  if (fileType === 34) {
    const storageClass = headerU16[3];
    const fileSubtype = headerU16[4];
    const geometry = reflectedGeometryInfo(storageClass, fileSubtype);
    mapped = {
      ...geometry,
      semanticType: 41,
      storageClass,
      fileSubtype,
      runtimeSubtype: RUNTIME_SUBTYPE_BY_FILE_SUBTYPE.get(fileSubtype) ?? null,
      constructionCode: 9,
    };
  }
  const object = {
    index,
    name: mapped?.name ?? `Unknown(${fileType})`,
    displayName: mapped?.label ?? `未知类型 ${fileType}`,
    fileType,
    semanticType: mapped?.semanticType ?? null,
    storageClass: mapped?.storageClass ?? null,
    fileSubtype: mapped?.fileSubtype ?? null,
    runtimeSubtype: mapped?.runtimeSubtype ?? null,
    constructionCode: mapped?.constructionCode ?? null,
    branch: mapped?.branch ?? null,
    headerOffset: `0x${headerRecord.offset.toString(16)}`,
    headerU16,
    visibilityFlags: headerU16[1],
    hidden: Boolean(headerU16[1] & 1),
    visible: !Boolean(headerU16[1] & 1),
    dependencies: [],
  };
  if (fileType === 34) {
    object.construction = "Reflection";
    object.transformation = "reflection";
  }

  for (const record of records.slice(1)) {
    const recordView = new DataView(record.payload.buffer, record.payload.byteOffset, record.payload.byteLength);
    if (record.tag === 2002 && record.payload.byteLength >= 4) {
      const count = recordView.getUint32(0, true);
      const available = Math.floor((record.payload.byteLength - 4) / 4);
      if (count > available) throw new Error(`对象 ${index} 的依赖表不完整`);
      object.dependencies = [];
      for (let i = 0; i < count; i += 1) {
        object.dependencies.push(recordView.getUint32(4 + i * 4, true));
      }
      object.dependencyOffset = `0x${record.offset.toString(16)}`;
    } else if (record.tag === 2005) {
      const label = decodeLabel(record.payload);
      if (label) object.label = label;
    } else if (record.tag === 2003 && fileType === 15 && record.payload.byteLength >= 4) {
      if ((record.payload.byteLength - 4) % 8 !== 0) {
        throw new Error(`对象 ${index} 的点约束参数格式错误`);
      }
      object.constraintType = recordView.getUint16(0, true);
      object.parentSubtype = recordView.getUint16(2, true);
      object.constraintParameters = [];
      for (let offset = 4; offset < record.payload.byteLength; offset += 8) {
        object.constraintParameters.push(recordView.getFloat64(offset, true));
      }
      object.constraintOffset = `0x${record.offset.toString(16)}`;
    } else if (record.tag === 2201 && record.payload.byteLength === 16) {
      object.coordinates = [recordView.getFloat64(0, true), recordView.getFloat64(8, true)];
      object.coordinateOffset = `0x${(record.offset + 8).toString(16)}`;
    }
  }
  return object;
}

function parseGsp(buffer, fileName) {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 4 || readAscii(bytes.slice(0, 4)) !== "GSP4") {
    throw new Error("不支持的文件：未检测到 GSP4 文件头");
  }
  const records = parseRecords(bytes);
  const groups = [];
  let current = null;
  for (const record of records) {
    if (record.tag === 2000) {
      current = [record];
      groups.push(current);
    } else if (current) {
      current.push(record);
      if (record.tag === 2007) current = null;
    }
  }
  const objects = groups.map((group, index) => decodeObject(index + 1, group));
  addDerivedGeometry(objects);
  return {
    fileName,
    magic: "GSP4",
    size: bytes.byteLength,
    recordCount: records.length,
    objects,
  };
}

function pointOf(object) {
  if (!object) return null;
  return object.derived?.valid === false ? null : (object.dependencies?.length ? object.derived?.point ?? null : object.coordinates ?? object.derived?.point ?? null);
}

function endpointsOf(object) {
  if (!object?.derived?.p1 || !object?.derived?.p2) return null;
  return [object.derived.p1, object.derived.p2];
}

function lineEquation(p1, p2) {
  return {
    a: p1[1] - p2[1],
    b: p2[0] - p1[0],
    c: p1[0] * p2[1] - p2[0] * p1[1],
  };
}

function reflectPointAcrossLine(point, mirrorP1, mirrorP2) {
  const dx = mirrorP2[0] - mirrorP1[0];
  const dy = mirrorP2[1] - mirrorP1[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-24) return null;
  const projection = (
    (point[0] - mirrorP1[0]) * dx +
    (point[1] - mirrorP1[1]) * dy
  ) / lengthSquared;
  const footX = mirrorP1[0] + projection * dx;
  const footY = mirrorP1[1] + projection * dy;
  return [2 * footX - point[0], 2 * footY - point[1]];
}

function intersectLines(p1, p2, p3, p4) {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const [x4, y4] = p4;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-12) return null;
  const det1 = x1 * y2 - y1 * x2;
  const det2 = x3 * y4 - y3 * x4;
  return [
    (det1 * (x3 - x4) - (x1 - x2) * det2) / denominator,
    (det1 * (y3 - y4) - (y1 - y2) * det2) / denominator,
  ];
}

function lineCircleIntersections(line, circle) {
  const endpoints = endpointsOf(line);
  const center = circle?.derived?.center;
  const radius = circle?.derived?.radius;
  if (!endpoints || !center || radius == null) return [];
  const [p1, p2] = endpoints;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const fx = p1[0] - center[0];
  const fy = p1[1] - center[1];
  const a = dx * dx + dy * dy;
  if (!a) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-10) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const result = [];
  for (const branch of [1, -1]) {
    // Native GSP uses -branch * sqrt(D): type 11 (+1) selects the minus
    // root, while type 12 (-1) selects the plus root.
    const t = (-b - branch * root) / (2 * a);
    const valid =
      INFINITE_LINE_TYPES.has(line.name) ||
      (line.name === "Ray" && t >= -1e-10) ||
      (line.name === "Segment" && t >= -1e-10 && t <= 1 + 1e-10);
    if (valid) result.push({ branch, t, point: [p1[0] + t * dx, p1[1] + t * dy] });
  }
  return result;
}

function circleCircleIntersections(first, second) {
  const c0 = first?.derived?.center;
  const r0 = first?.derived?.radius;
  const c1 = second?.derived?.center;
  const r1 = second?.derived?.radius;
  if (!c0 || r0 == null || !c1 || r1 == null) return [];
  const dx = c1[0] - c0[0];
  const dy = c1[1] - c0[1];
  const distance = Math.hypot(dx, dy);
  if (!distance || distance > r0 + r1 + 1e-10 || distance < Math.abs(r0 - r1) - 1e-10) return [];
  const along = (r0 ** 2 - r1 ** 2 + distance ** 2) / (2 * distance);
  const heightSquared = r0 ** 2 - along ** 2;
  if (heightSquared < -1e-10) return [];
  const height = Math.sqrt(Math.max(0, heightSquared));
  const baseX = c0[0] + (along * dx) / distance;
  const baseY = c0[1] + (along * dy) / distance;
  return [1, -1].map((branch) => ({
    branch,
    point: [
      baseX + (branch * dy * height) / distance,
      baseY - (branch * dx * height) / distance,
    ],
  }));
}

function circumcircle(a, b, c) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const [cx, cy] = c;
  const denominator = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(denominator) < 1e-12) return null;
  const centerX = (
    (ax ** 2 + ay ** 2) * (by - cy) +
    (bx ** 2 + by ** 2) * (cy - ay) +
    (cx ** 2 + cy ** 2) * (ay - by)
  ) / denominator;
  const centerY = (
    (ax ** 2 + ay ** 2) * (cx - bx) +
    (bx ** 2 + by ** 2) * (ax - cx) +
    (cx ** 2 + cy ** 2) * (bx - ax)
  ) / denominator;
  return { center: [centerX, centerY], radius: Math.hypot(ax - centerX, ay - centerY) };
}

function addDerivedGeometry(objects) {
  const byIndex = new Map(objects.map((object) => [object.index, object]));
  for (const object of objects) {
    const parents = object.dependencies.map((index) => byIndex.get(index));
    const name = object.name;

    if (object.fileType === 34 && parents.length === 2) {
      const [source, mirror] = parents;
      const mirrorEndpoints = endpointsOf(mirror);
      if (!source || !mirrorEndpoints) {
        object.derived = { valid: false, reason: "源对象或镜面几何不可用" };
        continue;
      }
      const [mirrorP1, mirrorP2] = mirrorEndpoints;
      const base = {
        sourceObject: object.dependencies[0],
        mirrorObject: object.dependencies[1],
        mirrorKind: mirror.name,
        mirrorSupport: [mirrorP1, mirrorP2],
      };
      const sourcePoint = pointOf(source);
      const sourceEndpoints = endpointsOf(source);
      if (object.storageClass === 1 && sourcePoint) {
        const point = reflectPointAcrossLine(sourcePoint, mirrorP1, mirrorP2);
        object.derived = { ...base, valid: Boolean(point), point };
      } else if (object.storageClass === 2 && sourceEndpoints) {
        const p1 = reflectPointAcrossLine(sourceEndpoints[0], mirrorP1, mirrorP2);
        const p2 = reflectPointAcrossLine(sourceEndpoints[1], mirrorP1, mirrorP2);
        object.derived = {
          ...base,
          valid: Boolean(p1 && p2),
          p1,
          p2,
          equation: p1 && p2 ? lineEquation(p1, p2) : null,
        };
      } else if (object.storageClass === 3 && source.derived?.center && source.derived?.radius != null) {
        const center = reflectPointAcrossLine(source.derived.center, mirrorP1, mirrorP2);
        object.derived = { ...base, valid: Boolean(center), center, radius: Math.abs(source.derived.radius) };
      } else {
        object.derived = { ...base, valid: false, reason: "不支持的对称对象存储类" };
      }
    } else if (["Segment", "Line", "Ray"].includes(name) && parents.length === 2) {
      const p1 = pointOf(parents[0]);
      const p2 = pointOf(parents[1]);
      if (p1 && p2) {
        object.derived = { through: object.dependencies, p1, p2, equation: lineEquation(p1, p2) };
      }
    } else if (name === "Midpoint" && parents.length === 1) {
      const endpoints = endpointsOf(parents[0]);
      if (endpoints) {
        object.derived = {
          sourceObject: object.dependencies[0],
          point: [(endpoints[0][0] + endpoints[1][0]) / 2, (endpoints[0][1] + endpoints[1][1]) / 2],
        };
      }
    } else if (["PerpendicularLine", "ParallelLine"].includes(name) && parents.length === 2) {
      const anchor = pointOf(parents[0]);
      const endpoints = endpointsOf(parents[1]);
      if (anchor && endpoints) {
        const dx = endpoints[1][0] - endpoints[0][0];
        const dy = endpoints[1][1] - endpoints[0][1];
        const direction = name === "PerpendicularLine" ? [-dy, dx] : [dx, dy];
        const p2 = [anchor[0] + direction[0], anchor[1] + direction[1]];
        object.derived = {
          anchorObject: object.dependencies[0],
          baseObject: object.dependencies[1],
          p1: anchor,
          p2,
          equation: lineEquation(anchor, p2),
        };
      }
    } else if (name === "IntersectionPoint" && parents.length === 2) {
      const first = endpointsOf(parents[0]);
      const second = endpointsOf(parents[1]);
      const point = first && second ? intersectLines(first[0], first[1], second[0], second[1]) : null;
      object.derived = { sourceObjects: object.dependencies, valid: Boolean(point), point };
    } else if (name === "LineCircleIntersection" && parents.length === 2) {
      const line = parents.find((parent) => endpointsOf(parent));
      const circle = parents.find((parent) => parent?.name === "Circle");
      if (line && circle) {
        const candidates = lineCircleIntersections(line, circle);
        const selected = candidates.find((item) => item.branch === object.branch) ?? null;
        object.derived = {
          sourceObjects: object.dependencies,
          branch: object.branch,
          valid: Boolean(selected),
          point: selected?.point ?? null,
          lineParameter: selected?.t ?? null,
        };
      }
    } else if (name === "CircleCircleIntersection" && parents.length === 2) {
      const candidates = parents.every((parent) => parent?.name === "Circle")
        ? circleCircleIntersections(parents[0], parents[1])
        : [];
      const selected = candidates.find((item) => item.branch === object.branch) ?? null;
      object.derived = {
        sourceObjects: object.dependencies,
        branch: object.branch,
        valid: Boolean(selected),
        point: selected?.point ?? null,
      };
    } else if (name === "AngleBisector" && parents.length === 3) {
      const [a, vertex, c] = parents.map(pointOf);
      if (a && vertex && c) {
        const ux = a[0] - vertex[0];
        const uy = a[1] - vertex[1];
        const vx = c[0] - vertex[0];
        const vy = c[1] - vertex[1];
        const un = Math.hypot(ux, uy);
        const vn = Math.hypot(vx, vy);
        const direction = un && vn ? [ux / un + vx / vn, uy / un + vy / vn] : null;
        if (direction && Math.hypot(...direction) >= 1e-12) {
          const p2 = [vertex[0] + direction[0], vertex[1] + direction[1]];
          object.derived = { anglePoints: object.dependencies, p1: vertex, p2, equation: lineEquation(vertex, p2) };
        } else {
          object.derived = { valid: false, reason: "退化角" };
        }
      }
    } else if (name === "Circle" && parents.length === 2) {
      const center = pointOf(parents[0]);
      const through = pointOf(parents[1]);
      if (center && through) {
        object.derived = {
          centerObject: object.dependencies[0],
          throughObject: object.dependencies[1],
          center,
          radius: Math.hypot(through[0] - center[0], through[1] - center[1]),
        };
      }
    } else if (name === "PointOnObject" && parents.length === 1) {
      const parent = parents[0];
      const parameters = object.constraintParameters ?? [];
      if (!parent || !parameters.length) continue;
      const endpoints = endpointsOf(parent);
      if (endpoints) {
        const parameter = parameters[0];
        const point = [
          endpoints[0][0] + parameter * (endpoints[1][0] - endpoints[0][0]),
          endpoints[0][1] + parameter * (endpoints[1][1] - endpoints[0][1]),
        ];
        let valid = true;
        if (parent.name === "Segment") valid = parameter >= -1e-10 && parameter <= 1 + 1e-10;
        if (parent.name === "Ray") valid = parameter >= -1e-10;
        object.derived = {
          sourceObject: object.dependencies[0],
          parentKind: parent.name,
          parameter,
          valid,
          point,
        };
      } else if (parent.name === "Circle" && parameters.length >= 2) {
        const center = parent.derived?.center;
        const radius = parent.derived?.radius;
        if (!center || radius == null) continue;
        const [ux, uy] = parameters;
        object.derived = {
          sourceObject: object.dependencies[0],
          parentKind: parent.name,
          parameters: [ux, uy],
          parameterNorm: Math.hypot(ux, uy),
          valid: true,
          point: [center[0] + radius * ux, center[1] - radius * uy],
        };
      } else if (parent.name === "ArcThroughThreePoints" && parent.derived?.valid) {
        const parameter = parameters[0];
        const { start, center, radius, sweepFlag, arcRadians } = parent.derived;
        const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
        const direction = sweepFlag ? 1 : -1;
        const angle = startAngle + direction * arcRadians * parameter;
        object.derived = {
          sourceObject: object.dependencies[0],
          parentKind: parent.name,
          parameter,
          valid: parameter >= -1e-10 && parameter <= 1 + 1e-10,
          point: [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)],
        };
      }
    } else if (name === "ArcThroughThreePoints" && parents.length === 3) {
      const [start, through, end] = parents.map(pointOf);
      const circle = start && through && end ? circumcircle(start, through, end) : null;
      if (!circle) {
        object.derived = { valid: false, reason: "三点共线" };
      } else {
        const startAngle = Math.atan2(start[1] - circle.center[1], start[0] - circle.center[0]);
        const throughAngle = Math.atan2(through[1] - circle.center[1], through[0] - circle.center[0]);
        const endAngle = Math.atan2(end[1] - circle.center[1], end[0] - circle.center[0]);
        const positiveDelta = ((endAngle - startAngle) % TWO_PI + TWO_PI) % TWO_PI;
        const throughDelta = ((throughAngle - startAngle) % TWO_PI + TWO_PI) % TWO_PI;
        const sweepFlag = throughDelta <= positiveDelta + 1e-12 ? 1 : 0;
        const arcRadians = sweepFlag ? positiveDelta : TWO_PI - positiveDelta;
        object.derived = {
          anglePoints: object.dependencies,
          valid: true,
          start,
          through,
          end,
          center: circle.center,
          radius: circle.radius,
          sweepFlag,
          largeArcFlag: arcRadians > Math.PI ? 1 : 0,
          arcRadians,
        };
      }
    }
  }
}

function geometryBounds(objects) {
  const points = [];
  for (const object of objects) {
    const point = pointOf(object);
    if (point) points.push(point);
    if (object.name === "Segment") {
      const endpoints = endpointsOf(object);
      if (endpoints) points.push(...endpoints);
    }
    if (["Circle", "ArcThroughThreePoints"].includes(object.name)) {
      const center = object.derived?.center;
      const radius = object.derived?.radius;
      if (center && radius != null) {
        points.push([center[0] - radius, center[1] - radius], [center[0] + radius, center[1] + radius]);
      }
    }
  }
  if (!points.length) return { x: 0, y: 0, width: 800, height: 600 };
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 100);
  const margin = Math.max(42, span * 0.1);
  return {
    x: Math.min(...xs) - margin,
    y: Math.min(...ys) - margin,
    width: Math.max(...xs) - Math.min(...xs) + margin * 2,
    height: Math.max(...ys) - Math.min(...ys) + margin * 2,
  };
}

function clipInfiniteLine(p1, p2, bounds) {
  const { x: xmin, y: ymin, width, height } = bounds;
  const xmax = xmin + width;
  const ymax = ymin + height;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  if (Math.hypot(dx, dy) < 1e-12) return null;
  const candidates = [];
  if (Math.abs(dx) > 1e-12) {
    for (const edgeX of [xmin, xmax]) {
      const t = (edgeX - p1[0]) / dx;
      const edgeY = p1[1] + t * dy;
      if (edgeY >= ymin - 1e-8 && edgeY <= ymax + 1e-8) candidates.push([edgeX, edgeY]);
    }
  }
  if (Math.abs(dy) > 1e-12) {
    for (const edgeY of [ymin, ymax]) {
      const t = (edgeY - p1[1]) / dy;
      const edgeX = p1[0] + t * dx;
      if (edgeX >= xmin - 1e-8 && edgeX <= xmax + 1e-8) candidates.push([edgeX, edgeY]);
    }
  }
  const unique = candidates.filter((point, index) =>
    candidates.findIndex((other) => Math.hypot(point[0] - other[0], point[1] - other[1]) < 1e-7) === index
  );
  if (unique.length < 2) return null;
  let best = [unique[0], unique[1]];
  let bestDistance = 0;
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const distance = Math.hypot(unique[i][0] - unique[j][0], unique[i][1] - unique[j][1]);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [unique[i], unique[j]];
      }
    }
  }
  return best;
}

function clipRay(p1, p2, bounds) {
  const { x: xmin, y: ymin, width, height } = bounds;
  const xmax = xmin + width;
  const ymax = ymin + height;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  if (Math.hypot(dx, dy) < 1e-12) return null;
  const candidates = [];
  if (p1[0] >= xmin && p1[0] <= xmax && p1[1] >= ymin && p1[1] <= ymax) candidates.push({ t: 0, point: p1 });
  if (Math.abs(dx) > 1e-12) {
    for (const edgeX of [xmin, xmax]) {
      const t = (edgeX - p1[0]) / dx;
      const edgeY = p1[1] + t * dy;
      if (t >= -1e-10 && edgeY >= ymin - 1e-8 && edgeY <= ymax + 1e-8) {
        candidates.push({ t: Math.max(0, t), point: [edgeX, edgeY] });
      }
    }
  }
  if (Math.abs(dy) > 1e-12) {
    for (const edgeY of [ymin, ymax]) {
      const t = (edgeY - p1[1]) / dy;
      const edgeX = p1[0] + t * dx;
      if (t >= -1e-10 && edgeX >= xmin - 1e-8 && edgeX <= xmax + 1e-8) {
        candidates.push({ t: Math.max(0, t), point: [edgeX, edgeY] });
      }
    }
  }
  candidates.sort((a, b) => a.t - b.t);
  const unique = candidates.filter((item, index) =>
    candidates.findIndex((other) => Math.hypot(item.point[0] - other.point[0], item.point[1] - other.point[1]) < 1e-7) === index
  );
  if (unique.length < 2) return null;
  return [unique[0].point, unique.at(-1).point];
}


if (typeof module !== 'undefined') module.exports = {parseGsp, addDerivedGeometry, pointOf, endpointsOf, circumcircle, geometryBounds, clipInfiniteLine, clipRay, POINT_TYPES, INFINITE_LINE_TYPES};
else globalThis.Geometry = {parseGsp, addDerivedGeometry, pointOf, endpointsOf, circumcircle, geometryBounds, clipInfiniteLine, clipRay, POINT_TYPES, INFINITE_LINE_TYPES};
