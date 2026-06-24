"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Standing } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ClassementsTabProps {
  groups: any[];
  standingsByGroup: Record<string, Standing[]>;
}

export function ClassementsTab({
  groups,
  standingsByGroup,
}: ClassementsTabProps) {
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Aucune poule créée
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group: any) => {
        const standings = standingsByGroup[group.id] || [];
        return (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {standings.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">
                  Aucune équipe dans cette poule
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Équipe</TableHead>
                      <TableHead className="text-center w-10">MJ</TableHead>
                      <TableHead className="text-center w-10">V</TableHead>
                      <TableHead className="text-center w-10">N</TableHead>
                      <TableHead className="text-center w-10">D</TableHead>
                      <TableHead className="text-center w-14 hidden sm:table-cell">BP</TableHead>
                      <TableHead className="text-center w-14 hidden sm:table-cell">BC</TableHead>
                      <TableHead className="text-center w-14 hidden sm:table-cell">DB</TableHead>
                      <TableHead className="text-center w-12 font-bold">Pts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((s, index) => (
                      <TableRow
                        key={s.teamId}
                        className={index < 2 ? "bg-brand/5" : ""}
                      >
                        <TableCell className="font-bold text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {s.teamName}
                        </TableCell>
                        <TableCell className="text-center">{s.played}</TableCell>
                        <TableCell className="text-center text-green-700">
                          {s.won}
                        </TableCell>
                        <TableCell className="text-center text-amber-600">
                          {s.drawn}
                        </TableCell>
                        <TableCell className="text-center text-red-600">
                          {s.lost}
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {s.goalsFor}
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {s.goalsAgainst}
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {s.goalDifference > 0
                            ? `+${s.goalDifference}`
                            : s.goalDifference}
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg text-brand">
                          {s.points}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
